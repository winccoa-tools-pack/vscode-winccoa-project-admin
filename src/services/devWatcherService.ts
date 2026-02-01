import * as vscode from 'vscode';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { PmonComponent } from '@winccoa-tools-pack/npm-winccoa-core';
import { ExtensionOutputChannel } from '../extensionOutput';
import { ManagerWatchConfig, WatcherState, WatcherStatus, PersistedWatcherState } from '../types';

const SOURCE = 'DevWatcher';

/**
 * Service for watching files and auto-restarting WinCC OA managers
 */
export class DevWatcherService {
    private watchers: Map<string, chokidar.FSWatcher> = new Map();
    private states: Map<string, WatcherState> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private restartingManagers: Set<string> = new Set();
    private pendingRestarts: Set<string> = new Set();

    private _onDidChangeState = new vscode.EventEmitter<WatcherState>();
    readonly onDidChangeState = this._onDidChangeState.event;

    constructor(
        private context: vscode.ExtensionContext,
        private pmon: PmonComponent
    ) {}

    /**
     * Generate unique key for a manager watcher
     */
    private getWatcherKey(projectId: string, managerIndex: number): string {
        return `${projectId}:${managerIndex}`;
    }

    /**
     * Get configuration settings
     */
    private getConfig() {
        const config = vscode.workspace.getConfiguration('winccoaProjectAdmin.devWatcher');
        return {
            defaultPatterns: config.get<Record<string, string[]>>('defaultPatterns', {}),
            debounceMs: config.get<number>('debounceMs', 500),
            ignoredPatterns: config.get<string[]>('ignoredPatterns', ['**/node_modules/**', '**/dist/**', '**/*.d.ts']),
            maxRetries: config.get<number>('maxRetries', 3)
        };
    }

    /**
     * Get default watch patterns for a manager type
     */
    getDefaultPatternsForManager(managerType: string): string[] {
        const config = this.getConfig();

        // Check for exact match first, then prefix match
        for (const [key, patterns] of Object.entries(config.defaultPatterns)) {
            if (managerType.toLowerCase().startsWith(key.toLowerCase())) {
                return patterns;
            }
        }

        return [];
    }

    /**
     * Resolve watch paths relative to project directory
     */
    private resolveWatchPaths(watchPaths: string[], projectDir: string): string[] {
        return watchPaths.map(p => {
            // If absolute path (Windows drive letter or UNC path), use as-is
            if (/^[A-Z]:\\/i.test(p) || p.startsWith('\\\\')) {
                return p;
            }
            // Resolve relative to project root
            return path.join(projectDir, p);
        });
    }

    /**
     * Check if manager type uses TypeScript
     */
    private isTypeScriptManager(managerType: string, projectDir: string): boolean {
        const tsManagerTypes = ['node', 'wccoanode'];
        const isNodeType = tsManagerTypes.some(t =>
            managerType.toLowerCase().startsWith(t.toLowerCase())
        );

        if (!isNodeType) {
            return false;
        }

        // Also check if tsconfig.json exists
        const tsconfigPath = path.join(projectDir, 'javascript', 'tsconfig.json');
        return fs.existsSync(tsconfigPath);
    }

    /**
     * Start watching files for a manager
     */
    async startWatcher(
        projectId: string,
        managerIndex: number,
        projectDir: string,
        version: string,
        managerType: string,
        watchConfig?: Partial<ManagerWatchConfig>
    ): Promise<void> {
        const key = this.getWatcherKey(projectId, managerIndex);

        // Stop existing watcher if any
        if (this.watchers.has(key)) {
            this.stopWatcher(projectId, managerIndex);
        }

        // Get configuration
        const globalConfig = this.getConfig();

        // Build full config
        const config: ManagerWatchConfig = {
            projectId,
            managerIndex,
            enabled: true,
            watchPaths: watchConfig?.watchPaths || this.getDefaultPatternsForManager(managerType),
            customIgnorePatterns: watchConfig?.customIgnorePatterns,
            waitForTsc: watchConfig?.waitForTsc ?? this.isTypeScriptManager(managerType, projectDir)
        };

        // Validate watch paths
        if (config.watchPaths.length === 0) {
            throw new Error(`No watch paths configured for ${managerType}. Configure paths first.`);
        }

        // Resolve paths
        const resolvedPaths = this.resolveWatchPaths(config.watchPaths, projectDir);
        const ignoredPatterns = [...globalConfig.ignoredPatterns, ...(config.customIgnorePatterns || [])];

        ExtensionOutputChannel.info(SOURCE, `Starting watcher for ${projectId}:${managerIndex} (${managerType})`);
        ExtensionOutputChannel.debug(SOURCE, `Watch paths: ${resolvedPaths.join(', ')}`);
        ExtensionOutputChannel.debug(SOURCE, `Ignored patterns: ${ignoredPatterns.join(', ')}`);
        ExtensionOutputChannel.debug(SOURCE, `Wait for TSC: ${config.waitForTsc}`);

        // Set version for pmon
        this.pmon.setVersion(version);

        // Initialize state
        const state: WatcherState = {
            projectId,
            managerIndex,
            status: 'watching',
            watchedFileCount: 0
        };
        this.states.set(key, state);

        // Create chokidar watcher
        const watcher = chokidar.watch(resolvedPaths, {
            ignored: ignoredPatterns,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
            }
        });

        watcher.on('ready', () => {
            const watched = watcher.getWatched();
            let fileCount = 0;
            for (const dir of Object.values(watched)) {
                fileCount += dir.length;
            }

            state.watchedFileCount = fileCount;
            ExtensionOutputChannel.info(SOURCE, `Watcher ready for ${managerType} (${fileCount} files)`);
            this._onDidChangeState.fire({ ...state });
        });

        watcher.on('change', (filePath) => this.onFileChange(key, filePath, 'changed', config, globalConfig.debounceMs));
        watcher.on('add', (filePath) => this.onFileChange(key, filePath, 'added', config, globalConfig.debounceMs));
        watcher.on('unlink', (filePath) => this.onFileChange(key, filePath, 'removed', config, globalConfig.debounceMs));

        watcher.on('error', (error) => {
            ExtensionOutputChannel.error(SOURCE, `Watcher error for ${key}`, error instanceof Error ? error : new Error(String(error)));
            this.updateState(key, { status: 'error', error: String(error) });
        });

        this.watchers.set(key, watcher);

        // Save to workspace state for config persistence
        this.saveWatcherConfig(projectId, managerIndex, config);

        // Save active state for restoration
        this.saveActiveWatchers();

        this._onDidChangeState.fire(state);
    }

    /**
     * Handle file change event
     */
    private onFileChange(
        key: string,
        filePath: string,
        action: string,
        config: ManagerWatchConfig,
        debounceMs: number
    ): void {
        const state = this.states.get(key);
        if (!state) return;

        ExtensionOutputChannel.debug(SOURCE, `File ${action}: ${filePath}`);

        // Update last change time
        state.lastChange = new Date();
        this._onDidChangeState.fire({ ...state });

        // Clear existing debounce timer
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new debounce timer
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);

            if (config.waitForTsc && filePath.endsWith('.ts')) {
                // For TypeScript files, wait a bit longer for compilation
                ExtensionOutputChannel.info(SOURCE, `TypeScript file changed, waiting for compilation...`);
                setTimeout(() => this.triggerRestart(key), 2000);
            } else {
                this.triggerRestart(key);
            }
        }, debounceMs);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Trigger manager restart
     */
    private async triggerRestart(key: string, retryCount: number = 0): Promise<void> {
        const state = this.states.get(key);
        if (!state) return;

        // Check if already restarting
        if (this.restartingManagers.has(key)) {
            this.pendingRestarts.add(key);
            ExtensionOutputChannel.debug(SOURCE, `Restart already in progress for ${key}, queuing`);
            return;
        }

        this.restartingManagers.add(key);
        this.updateState(key, { status: 'restarting' });

        const { projectId, managerIndex } = state;
        const globalConfig = this.getConfig();

        ExtensionOutputChannel.info(SOURCE, `Restarting manager ${managerIndex} for ${projectId}...`);

        try {
            // Stop manager
            const stopResult = await this.pmon.stopManager(projectId, managerIndex);
            if (stopResult !== 0) {
                throw new Error(`Failed to stop manager (exit code: ${stopResult})`);
            }

            // Wait for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Start manager
            const startResult = await this.pmon.startManager(projectId, managerIndex);
            if (startResult !== 0) {
                throw new Error(`Failed to start manager (exit code: ${startResult})`);
            }

            ExtensionOutputChannel.success(SOURCE, `Manager ${managerIndex} restarted successfully`);
            this.updateState(key, {
                status: 'watching',
                lastRestart: new Date(),
                error: undefined
            });

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            ExtensionOutputChannel.error(SOURCE, `Failed to restart manager: ${errorMsg}`);

            // Retry logic
            if (retryCount < globalConfig.maxRetries) {
                ExtensionOutputChannel.info(SOURCE, `Retrying restart (${retryCount + 1}/${globalConfig.maxRetries})...`);
                this.restartingManagers.delete(key);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.triggerRestart(key, retryCount + 1);
            }

            this.updateState(key, { status: 'error', error: errorMsg });
            vscode.window.showErrorMessage(`Dev Watcher: Failed to restart manager after ${globalConfig.maxRetries} attempts`);

        } finally {
            this.restartingManagers.delete(key);

            // Handle pending restart
            if (this.pendingRestarts.has(key)) {
                this.pendingRestarts.delete(key);
                setTimeout(() => this.triggerRestart(key), 500);
            }
        }
    }

    /**
     * Update watcher state and emit event
     */
    private updateState(key: string, updates: Partial<WatcherState>): void {
        const state = this.states.get(key);
        if (state) {
            Object.assign(state, updates);
            this._onDidChangeState.fire({ ...state });
        }
    }

    /**
     * Stop watcher for a manager
     */
    stopWatcher(projectId: string, managerIndex: number): void {
        const key = this.getWatcherKey(projectId, managerIndex);

        // Clear debounce timer
        const timer = this.debounceTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(key);
        }

        // Close chokidar watcher
        const watcher = this.watchers.get(key);
        if (watcher) {
            watcher.close();
            this.watchers.delete(key);
        }

        // Update state
        const state = this.states.get(key);
        if (state) {
            state.status = 'stopped';
            this._onDidChangeState.fire({ ...state });
        }
        this.states.delete(key);

        // Remove from persistence
        this.saveActiveWatchers();

        ExtensionOutputChannel.info(SOURCE, `Stopped watcher for ${projectId}:${managerIndex}`);
    }

    /**
     * Get watcher state for a manager
     */
    getState(projectId: string, managerIndex: number): WatcherState | undefined {
        const key = this.getWatcherKey(projectId, managerIndex);
        return this.states.get(key);
    }

    /**
     * Get all active watchers
     */
    getAllActiveWatchers(): WatcherState[] {
        return Array.from(this.states.values());
    }

    /**
     * Check if a watcher is active for a manager
     */
    isWatcherActive(projectId: string, managerIndex: number): boolean {
        const key = this.getWatcherKey(projectId, managerIndex);
        return this.watchers.has(key);
    }

    /**
     * Save watcher config to workspace state
     */
    private saveWatcherConfig(projectId: string, managerIndex: number, config: ManagerWatchConfig): void {
        const stateKey = `devWatcher.configs.${projectId}`;
        const configs = this.context.workspaceState.get<ManagerWatchConfig[]>(stateKey, []);

        // Update or add config
        const existingIndex = configs.findIndex(c => c.managerIndex === managerIndex);
        if (existingIndex >= 0) {
            configs[existingIndex] = config;
        } else {
            configs.push(config);
        }

        this.context.workspaceState.update(stateKey, configs);
    }

    /**
     * Get saved watcher config for a manager
     */
    getSavedConfig(projectId: string, managerIndex: number): ManagerWatchConfig | undefined {
        const stateKey = `devWatcher.configs.${projectId}`;
        const configs = this.context.workspaceState.get<ManagerWatchConfig[]>(stateKey, []);
        return configs.find(c => c.managerIndex === managerIndex);
    }

    /**
     * Save active watchers to global state for restoration
     */
    private saveActiveWatchers(): void {
        const activeWatchers: PersistedWatcherState[] = [];

        for (const [key, state] of this.states) {
            if (state.status !== 'stopped') {
                const config = this.getSavedConfig(state.projectId, state.managerIndex);
                if (config) {
                    activeWatchers.push({
                        projectId: state.projectId,
                        managerIndex: state.managerIndex,
                        config
                    });
                }
            }
        }

        this.context.globalState.update('devWatcher.activeWatchers', activeWatchers);
    }

    /**
     * Restore watchers from global state (called on extension activation)
     */
    async restoreWatchers(
        getProjectInfo: (projectId: string) => { projectDir: string; version: string } | undefined,
        getManagerType: (projectId: string, managerIndex: number) => string | undefined
    ): Promise<void> {
        const savedWatchers = this.context.globalState.get<PersistedWatcherState[]>('devWatcher.activeWatchers', []);

        if (savedWatchers.length === 0) {
            return;
        }

        ExtensionOutputChannel.info(SOURCE, `Restoring ${savedWatchers.length} watcher(s)...`);

        for (const saved of savedWatchers) {
            try {
                const projectInfo = getProjectInfo(saved.projectId);
                if (!projectInfo) {
                    ExtensionOutputChannel.warn(SOURCE, `Project ${saved.projectId} not found, skipping watcher restoration`);
                    continue;
                }

                const managerType = getManagerType(saved.projectId, saved.managerIndex);
                if (!managerType) {
                    ExtensionOutputChannel.warn(SOURCE, `Manager ${saved.managerIndex} not found in ${saved.projectId}, skipping`);
                    continue;
                }

                await this.startWatcher(
                    saved.projectId,
                    saved.managerIndex,
                    projectInfo.projectDir,
                    projectInfo.version,
                    managerType,
                    saved.config
                );

            } catch (error) {
                ExtensionOutputChannel.error(
                    SOURCE,
                    `Failed to restore watcher for ${saved.projectId}:${saved.managerIndex}`,
                    error instanceof Error ? error : new Error(String(error))
                );
            }
        }
    }

    /**
     * Dispose all watchers
     */
    dispose(): void {
        ExtensionOutputChannel.info(SOURCE, 'Disposing all watchers...');

        // Clear all debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // Close all watchers
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();

        // Clear states
        this.states.clear();
        this.restartingManagers.clear();
        this.pendingRestarts.clear();

        this._onDidChangeState.dispose();
    }
}
