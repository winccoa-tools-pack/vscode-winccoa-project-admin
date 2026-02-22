import * as vscode from 'vscode';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { PmonComponent, ProjEnvManagerState } from '@winccoa-tools-pack/npm-winccoa-core';
import { ExtensionOutputChannel } from '../extensionOutput';
import { ManagerWatchConfig, WatcherState, PersistedWatcherState } from '../types';

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
    getDefaultPatternsForManager(managerType: string, startOptions?: string): string[] {
        const config = this.getConfig();
        const patterns: string[] = [];

        // Extract specific file from start options for any manager type
        if (startOptions) {
            const file = this.extractFileFromOptions(startOptions);
            if (file) {
                patterns.push(file);
            }
        }

        // Add default patterns for the manager type
        for (const [key, defaultPatterns] of Object.entries(config.defaultPatterns)) {
            if (managerType.toLowerCase().startsWith(key.toLowerCase())) {
                patterns.push(...defaultPatterns);
                break;
            }
        }

        return [...new Set(patterns)];
    }

    /**
     * Extract file path from manager start options.
     * Supports common WinCC OA file extensions: .ctl, .ctc, .lst, .pnl, .xml, .js, .ts
     */
    private extractFileFromOptions(startOptions: string): string | undefined {
        const fileMatch = startOptions.match(/(?:^|\s)([^\s]+\.(?:ctl|ctc|lst|pnl|xml|js|ts))(?:\s|$)/i);
        if (!fileMatch) {
            return undefined;
        }

        let file = fileMatch[1];

        // If the file doesn't have a path (no / or \), prepend a default directory based on extension
        if (!file.includes('/') && !file.includes('\\')) {
            const ext = path.extname(file).toLowerCase();
            if (ext === '.ctl' || ext === '.ctc' || ext === '.lst') {
                file = `scripts/${file}`;
            } else if (ext === '.js' || ext === '.ts') {
                file = `javascript/${file}`;
            } else if (ext === '.pnl' || ext === '.xml') {
                file = `panels/${file}`;
            }
        }

        return file;
    }

    /**
     * Resolve watch paths relative to project directory and subprojects
     */
    private resolveWatchPaths(watchPaths: string[], projectDir: string): string[] {
        // Get all project paths (main + subprojects)
        const allProjectPaths = [projectDir, ...this.parseSubProjects(projectDir)];

        const resolvedPaths: string[] = [];

        for (const pattern of watchPaths) {
            if (/^[A-Z]:\\/i.test(pattern) || pattern.startsWith('\\\\')) {
                // Absolute path, use as-is
                resolvedPaths.push(pattern);
            } else {
                // Relative path - resolve against all project paths
                for (const projPath of allProjectPaths) {
                    resolvedPaths.push(path.join(projPath, pattern));
                }
            }
        }

        return resolvedPaths;
    }

    /**
     * Parse subprojects from config file
     * Returns array of proj_path entries (excluding the project itself)
     */
    private parseSubProjects(projectDir: string): string[] {
        try {
            const configPath = path.join(projectDir, 'config', 'config');
            if (!fs.existsSync(configPath)) {
                return [];
            }

            const content = fs.readFileSync(configPath, 'utf-8');
            const lines = content.split('\n');
            const projPaths: string[] = [];
            let inGeneralSection = false;

            for (const line of lines) {
                const trimmed = line.trim();

                // Check for section headers
                if (trimmed.startsWith('[')) {
                    inGeneralSection = trimmed === '[general]';
                    continue;
                }

                // Only process proj_path in [general] section
                if (inGeneralSection && trimmed.startsWith('proj_path')) {
                    const match = trimmed.match(/proj_path\s*=\s*"([^"]+)"/);
                    if (match && match[1]) {
                        const projPath = match[1];
                        // Exclude the project itself
                        if (projPath !== projectDir && !projPath.endsWith(path.basename(projectDir))) {
                            projPaths.push(projPath);
                        }
                    }
                }
            }

            if (projPaths.length > 0) {
                ExtensionOutputChannel.debug(SOURCE, `Found ${projPaths.length} subproject(s): ${projPaths.join(', ')}`);
            }

            return projPaths;
        } catch (error) {
            ExtensionOutputChannel.warn(SOURCE, `Failed to parse subprojects: ${error}`);
            return [];
        }
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
        startOptions?: string,
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
            watchPaths: watchConfig?.watchPaths || this.getDefaultPatternsForManager(managerType, startOptions),
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
            const directories: string[] = [];
            for (const [dir, files] of Object.entries(watched)) {
                fileCount += files.length;
                directories.push(dir);
            }

            state.watchedFileCount = fileCount;
            ExtensionOutputChannel.info(SOURCE, `Watcher ready for ${managerType} (${fileCount} files in ${directories.length} directories)`);
            ExtensionOutputChannel.debug(SOURCE, `Watching directories: ${directories.slice(0, 5).join(', ')}${directories.length > 5 ? ` ... and ${directories.length - 5} more` : ''}`);
            this._onDidChangeState.fire({ ...state });
        });

        watcher.on('change', (filePath) => this.onFileChange(key, filePath, 'changed', config, globalConfig.debounceMs));
        watcher.on('add', (filePath) => this.onFileChange(key, filePath, 'added', config, globalConfig.debounceMs));
        watcher.on('unlink', (filePath) => this.onFileChange(key, filePath, 'removed', config, globalConfig.debounceMs));

        watcher.on('error', (error) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            ExtensionOutputChannel.error(SOURCE, `Watcher error for ${key}: ${errorMsg}`, error instanceof Error ? error : new Error(String(error)));
            this.updateState(key, { status: 'error', error: errorMsg });
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
        if (!state) {
            ExtensionOutputChannel.debug(SOURCE, `No state found for ${key}, ignoring file change`);
            return;
        }

        ExtensionOutputChannel.debug(SOURCE, `File ${action}: ${filePath}`);

        // Update last change time
        state.lastChange = new Date();
        this._onDidChangeState.fire({ ...state });

        // Clear existing debounce timer
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            ExtensionOutputChannel.debug(SOURCE, `Clearing existing debounce timer for ${key}`);
            clearTimeout(existingTimer);
        }

        // Set new debounce timer
        ExtensionOutputChannel.debug(SOURCE, `Setting debounce timer (${debounceMs}ms) for ${key}`);
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);

            if (config.waitForTsc && filePath.endsWith('.ts')) {
                // For TypeScript files, wait a bit longer for compilation
                ExtensionOutputChannel.info(SOURCE, `TypeScript file changed, waiting 2s for compilation...`);
                setTimeout(() => {
                    ExtensionOutputChannel.debug(SOURCE, `Triggering restart after TypeScript compilation wait`);
                    this.triggerRestart(key);
                }, 2000);
            } else {
                ExtensionOutputChannel.debug(SOURCE, `Triggering restart after debounce`);
                this.triggerRestart(key);
            }
        }, debounceMs);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Wait for manager to reach a specific state
     */
    private async waitForManagerState(
        projectId: string,
        managerIndex: number,
        targetState: ProjEnvManagerState,
        timeoutMs: number = 10000,
        pollIntervalMs: number = 500
    ): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const status = await this.pmon.getProjectStatus(projectId);
            const manager = status?.managers?.[managerIndex];

            if (!manager) {
                ExtensionOutputChannel.debug(SOURCE, `Manager ${managerIndex} not found in status`);
                return false;
            }

            const stateStr = this.getStateString(manager.state);
            ExtensionOutputChannel.debug(SOURCE, `Manager ${managerIndex} current state: ${stateStr}, target: ${this.getStateString(targetState)}`);

            if (manager.state === targetState) {
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }

        return false;
    }

    /**
     * Get human-readable state string
     */
    private getStateString(state: ProjEnvManagerState): string {
        switch (state) {
            case ProjEnvManagerState.Running:
                return 'Running';
            case ProjEnvManagerState.NotRunning:
                return 'NotRunning';
            case ProjEnvManagerState.Init:
                return 'Init';
            default:
                return `Unknown(${state})`;
        }
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
        ExtensionOutputChannel.debug(SOURCE, `Restart attempt ${retryCount + 1}/${globalConfig.maxRetries + 1}`);

        try {
            // Stop manager
            ExtensionOutputChannel.debug(SOURCE, `Stopping manager ${managerIndex}...`);
            const stopResult = await this.pmon.stopManager(projectId, managerIndex);
            ExtensionOutputChannel.debug(SOURCE, `Stop command exit code: ${stopResult}`);

            if (stopResult !== 0) {
                throw new Error(`Failed to stop manager (exit code: ${stopResult})`);
            }

            // Wait for manager to actually stop (poll until NotRunning)
            ExtensionOutputChannel.debug(SOURCE, `Polling for manager ${managerIndex} to stop...`);
            const stopped = await this.waitForManagerState(projectId, managerIndex, ProjEnvManagerState.NotRunning, 10000, 300);

            if (!stopped) {
                ExtensionOutputChannel.warn(SOURCE, `Manager ${managerIndex} did not reach NotRunning state within timeout, proceeding anyway`);
            } else {
                ExtensionOutputChannel.debug(SOURCE, `Manager ${managerIndex} stopped successfully`);
            }

            // Start manager
            ExtensionOutputChannel.debug(SOURCE, `Starting manager ${managerIndex}...`);
            const startResult = await this.pmon.startManager(projectId, managerIndex);
            ExtensionOutputChannel.debug(SOURCE, `Start command exit code: ${startResult}`);

            if (startResult !== 0) {
                throw new Error(`Failed to start manager (exit code: ${startResult})`);
            }

            // Wait for manager to actually start (poll until Running)
            ExtensionOutputChannel.debug(SOURCE, `Polling for manager ${managerIndex} to start...`);
            const started = await this.waitForManagerState(projectId, managerIndex, ProjEnvManagerState.Running, 15000, 500);

            if (!started) {
                throw new Error(`Manager ${managerIndex} did not reach Running state within timeout`);
            }

            ExtensionOutputChannel.success(SOURCE, `Manager ${managerIndex} restarted successfully and verified running`);
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
            vscode.window.showErrorMessage(`Dev Watcher: Failed to restart manager after ${globalConfig.maxRetries} attempts: ${errorMsg}`);

        } finally {
            this.restartingManagers.delete(key);

            // Handle pending restart
            if (this.pendingRestarts.has(key)) {
                this.pendingRestarts.delete(key);
                ExtensionOutputChannel.debug(SOURCE, `Processing queued restart for ${key}`);
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
        ExtensionOutputChannel.debug(SOURCE, `Stopping watcher for ${key}`);

        // Clear debounce timer
        const timer = this.debounceTimers.get(key);
        if (timer) {
            ExtensionOutputChannel.debug(SOURCE, `Clearing debounce timer for ${key}`);
            clearTimeout(timer);
            this.debounceTimers.delete(key);
        }

        // Close chokidar watcher
        const watcher = this.watchers.get(key);
        if (watcher) {
            ExtensionOutputChannel.debug(SOURCE, `Closing chokidar watcher for ${key}`);
            watcher.close();
            this.watchers.delete(key);
        }

        // Clear any pending restarts
        if (this.pendingRestarts.has(key)) {
            ExtensionOutputChannel.debug(SOURCE, `Clearing pending restart for ${key}`);
            this.pendingRestarts.delete(key);
        }

        if (this.restartingManagers.has(key)) {
            ExtensionOutputChannel.debug(SOURCE, `Clearing restarting flag for ${key}`);
            this.restartingManagers.delete(key);
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

        for (const [, state] of this.states) {
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
        getManagerInfo: (projectId: string, managerIndex: number) => { type: string; startOptions?: string } | undefined
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

                const managerInfo = getManagerInfo(saved.projectId, saved.managerIndex);
                if (!managerInfo) {
                    ExtensionOutputChannel.warn(SOURCE, `Manager ${saved.managerIndex} not found in ${saved.projectId}, skipping`);
                    continue;
                }

                await this.startWatcher(
                    saved.projectId,
                    saved.managerIndex,
                    projectInfo.projectDir,
                    projectInfo.version,
                    managerInfo.type,
                    managerInfo.startOptions,
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
