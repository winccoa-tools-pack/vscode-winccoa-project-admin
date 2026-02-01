import * as vscode from 'vscode';
import { ProjectManager } from '../projectManager';
import {
    PmonComponent,
    ProjEnvManagerInfo,
    ProjEnvManagerState,
    ProjEnvManagerOptions,
} from '@winccoa-tools-pack/npm-winccoa-core';
import { ExtensionOutputChannel } from '../extensionOutput';
import { ManagerSettingsPanel } from './managerSettingsPanel';
import { DevWatcherService } from '../services/devWatcherService';
import { WatcherState } from '../types';

export interface ManagerDisplayData {
    idx: number;
    info: ProjEnvManagerInfo;
    options?: ProjEnvManagerOptions;
}

export class ManagerTreeProvider implements vscode.TreeDataProvider<ManagerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ManagerItem | undefined | null | void> =
        new vscode.EventEmitter<ManagerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ManagerItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private managers: ManagerDisplayData[] = [];
    private pollInterval: NodeJS.Timeout | undefined;
    private pmon: PmonComponent = new PmonComponent();
    private currentProjectId: string | undefined;
    private devWatcherService: DevWatcherService | undefined;
    private watcherStates: Map<string, WatcherState> = new Map();

    constructor(private projectManager: ProjectManager) {
        // Start polling for manager status
        this.startPolling();

        // Refresh when project changes
        this.projectManager.onDidChangeProject(() => {
            this.currentProjectId = undefined;
            this.refresh();
        });
    }

    private startPolling(): void {
        // Don't load on startup - wait for TreeView to be visible
        // Initial load will happen automatically when VS Code calls getChildren()

        this.pollInterval = setInterval(() => {
            this.loadManagers().catch((err) => {
                ExtensionOutputChannel.error(
                    'ManagerTreeProvider',
                    'Load failed',
                    err instanceof Error ? err : new Error(String(err)),
                );
            });
        }, 10000); // Poll every 10 seconds
    }

    dispose(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }

    private async loadManagers(): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();

        if (!currentProject) {
            this.managers = [];
            this.currentProjectId = undefined;
            // Don't fire immediately - let getChildren() show loading state
            return;
        }

        try {
            this.currentProjectId = currentProject.id;

            // Set WinCC OA version for pmon component (already parsed in toProjectInfo())
            if (!currentProject.version || currentProject.version === 'unknown') {
                ExtensionOutputChannel.warn(
                    'ManagerTreeProvider',
                    `Project ${currentProject.id} has invalid version: ${currentProject.version}`,
                );
                this.managers = [];
                this._onDidChangeTreeData.fire();
                return;
            }

            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Setting WinCC OA version: ${currentProject.version}`,
            );
            this.pmon.setVersion(currentProject.version);

            // Get project status with manager info
            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Getting project status for: ${currentProject.id}`,
            );
            const projectStatus = await this.pmon.getProjectStatus(currentProject.id);

            // Get manager options (component names, start modes, etc.)
            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Getting manager options list for: ${currentProject.id}`,
            );
            const managerOptions = await this.pmon.getManagerOptionsList(currentProject.id);

            if (projectStatus && projectStatus.managers) {
                this.managers = projectStatus.managers
                    .map((info, idx) => ({
                        idx,
                        info,
                        options: managerOptions[idx],
                    }))
                    .filter((m) => m.idx > 0); // Skip pmon itself (idx 0)
            } else {
                this.managers = [];
            }

            this._onDidChangeTreeData.fire();
        } catch (error) {
            ExtensionOutputChannel.error(
                'ManagerTreeProvider',
                'Failed to load managers',
                error instanceof Error ? error : new Error(String(error)),
            );
            this.managers = [];
            this._onDidChangeTreeData.fire();
        }
    }

    refresh(): void {
        this.loadManagers();
    }

    /**
     * Get current manager list for Language Model Tools
     */
    getManagers(): ManagerDisplayData[] {
        return this.managers;
    }

    /**
     * Get current project ID
     */
    getCurrentProjectId(): string | undefined {
        return this.currentProjectId;
    }

    getTreeItem(element: ManagerItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ManagerItem): Promise<ManagerItem[]> {
        if (!element) {
            const currentProject = this.projectManager.getCurrentProject();

            if (!currentProject) {
                return [
                    new ManagerItem(
                        'No project selected',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        'Select a project from status bar',
                        undefined,
                    ),
                ];
            }

            // Check if project is running
            if (!currentProject.isRunning) {
                return [
                    new ManagerItem(
                        'Project not running',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        'Start the project to see managers',
                        undefined,
                    ),
                ];
            }

            // Root level - show Managers folder
            const managerCount =
                this.managers.length > 0 ? `${this.managers.length} managers` : 'No managers';
            return [
                new ManagerItem(
                    'Managers',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'folder',
                    managerCount,
                    undefined,
                ),
            ];
        } else if (element.label === 'Managers' && element.itemType === 'folder') {
            // Show all managers
            if (this.managers.length === 0) {
                return [
                    new ManagerItem(
                        'No managers found',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        'Check project configuration',
                        undefined,
                    ),
                ];
            }

            return this.managers.map((mgr) => {
                const componentName = mgr.options?.component || 'Unknown';
                const startOptions = mgr.options?.startOptions || '';
                const watcherState = this.getWatcherState(mgr.idx);

                return new ManagerItem(
                    componentName,
                    vscode.TreeItemCollapsibleState.None,
                    'manager',
                    this.getStatusText(mgr.info.state),
                    mgr,
                    startOptions,
                    watcherState
                );
            });
        }
        return [];
    }

    private getStatusText(state: ProjEnvManagerState): string {
        switch (state) {
            case ProjEnvManagerState.Running:
                return 'running';
            case ProjEnvManagerState.NotRunning:
                return 'stopped';
            case ProjEnvManagerState.Init:
                return 'initializing';
            case ProjEnvManagerState.Blocked:
                return 'blocked';
            default:
                return 'unknown';
        }
    }

    async startManager(managerData: ManagerDisplayData): Promise<void> {
        if (!this.currentProjectId) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        try {
            ExtensionOutputChannel.info(
                'ManagerTreeProvider',
                `Starting manager ${managerData.idx} for project: ${this.currentProjectId}`,
            );
            const result = await this.pmon.startManager(this.currentProjectId, managerData.idx);
            if (result === 0) {
                vscode.window.showInformationMessage(`✓ Manager started successfully`);
            } else {
                vscode.window.showErrorMessage(`Failed to start manager (error code: ${result})`);
            }
            await this.loadManagers();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start manager: ${error}`);
        }
    }

    async stopManager(managerData: ManagerDisplayData): Promise<void> {
        if (!this.currentProjectId) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        try {
            ExtensionOutputChannel.info(
                'ManagerTreeProvider',
                `Stopping manager ${managerData.idx} for project: ${this.currentProjectId}`,
            );
            const result = await this.pmon.stopManager(this.currentProjectId, managerData.idx);
            if (result === 0) {
                vscode.window.showInformationMessage(`✓ Manager stopped successfully`);
            } else {
                vscode.window.showErrorMessage(`Failed to stop manager (error code: ${result})`);
            }
            await this.loadManagers();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to stop manager: ${error}`);
        }
    }

    async restartManager(managerData: ManagerDisplayData): Promise<void> {
        if (!this.currentProjectId) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        try {
            vscode.window.showInformationMessage('⟳ Restarting manager...');

            // Stop then start
            ExtensionOutputChannel.info(
                'ManagerTreeProvider',
                `Restarting manager ${managerData.idx} for project: ${this.currentProjectId}`,
            );
            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Stopping manager ${managerData.idx}`,
            );
            const stopResult = await this.pmon.stopManager(this.currentProjectId, managerData.idx);
            if (stopResult !== 0) {
                vscode.window.showErrorMessage(
                    `Failed to stop manager (error code: ${stopResult})`,
                );
                return;
            }

            // Wait a bit before starting
            await new Promise((resolve) => setTimeout(resolve, 1000));

            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Starting manager ${managerData.idx}`,
            );
            const startResult = await this.pmon.startManager(
                this.currentProjectId,
                managerData.idx,
            );
            if (startResult === 0) {
                vscode.window.showInformationMessage(`✓ Manager restarted successfully`);
            } else {
                vscode.window.showErrorMessage(
                    `Failed to restart manager (error code: ${startResult})`,
                );
            }

            await this.loadManagers();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to restart manager: ${error}`);
        }
    }

    async deleteManager(item: { managerData?: ManagerDisplayData }): Promise<void> {
        if (!this.currentProjectId || !item.managerData) {
            vscode.window.showErrorMessage('No manager selected');
            return;
        }

        const managerData = item.managerData;
        const managerName = managerData.options?.component || `Manager ${managerData.idx}`;

        try {
            // Simple confirmation
            const confirm = await vscode.window.showWarningMessage(
                `Delete manager "${managerName}" - are you sure?`,
                { modal: true },
                'Yes, delete',
            );

            if (confirm !== 'Yes, delete') {
                ExtensionOutputChannel.debug(
                    'ManagerTreeProvider',
                    'User cancelled manager deletion',
                );
                return;
            }

            // Safety check: Don't allow deleting critical managers
            if (managerData.idx <= 1) {
                vscode.window.showErrorMessage('Cannot delete PMON or Data Manager (index 0-1)');
                return;
            }

            // Check if manager is running
            if (managerData.info.state === ProjEnvManagerState.Running) {
                const stopFirst = await vscode.window.showWarningMessage(
                    `Manager "${managerName}" is currently running. Stop it first?`,
                    { modal: true },
                    'Stop and Delete',
                );

                if (stopFirst !== 'Stop and Delete') {
                    return;
                }

                // Stop the manager first
                ExtensionOutputChannel.info(
                    'ManagerTreeProvider',
                    `Stopping manager ${managerData.idx} before deletion`,
                );
                const stopResult = await this.pmon.stopManager(
                    this.currentProjectId,
                    managerData.idx,
                );
                if (stopResult !== 0) {
                    vscode.window.showErrorMessage(
                        `Failed to stop manager (error code: ${stopResult})`,
                    );
                    return;
                }

                // Wait longer for manager to stop (5 seconds)
                ExtensionOutputChannel.debug(
                    'ManagerTreeProvider',
                    'Waiting 5 seconds for manager to stop...',
                );
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }

            // Execute delete
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Deleting ${managerName}...`,
                    cancellable: false,
                },
                async () => {
                    ExtensionOutputChannel.info(
                        'ManagerTreeProvider',
                        `Deleting manager ${managerData.idx} from project: ${this.currentProjectId}`,
                    );

                    const exitCode = await this.pmon.removeManager(
                        this.currentProjectId!,
                        managerData.idx,
                    );

                    if (exitCode === 0) {
                        vscode.window.showInformationMessage(
                            `✓ Manager "${managerName}" deleted successfully`,
                        );

                        // Wait a bit for config to be written
                        await new Promise((resolve) => setTimeout(resolve, 500));

                        // Reload managers
                        await this.loadManagers();
                        this._onDidChangeTreeData.fire();
                    } else {
                        vscode.window.showErrorMessage(
                            `Failed to delete manager (exit code: ${exitCode})`,
                        );
                        ExtensionOutputChannel.error(
                            'ManagerTreeProvider',
                            `removeManager failed with exit code: ${exitCode}`,
                        );
                    }
                },
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to delete manager: ${errorMsg}`);
            ExtensionOutputChannel.error(
                'ManagerTreeProvider',
                'Error during removeManager',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    }

    async addManager(): Promise<void> {
        if (!this.currentProjectId) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        try {
            // Get current managers to detect existing numbers
            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Getting manager options list for project: ${this.currentProjectId}`,
            );
            const managers = await this.pmon.getManagerOptionsList(this.currentProjectId);

            // Step 1: Select Manager Type
            const managerTypes = [
                { label: 'WCCOActrl', detail: 'Control Manager - CTL script execution' },
                { label: 'WCCOAui', detail: 'User Interface Manager - Panels and HMI' },
                { label: 'WCCILevent', detail: 'Event Manager - Alarm handling' },
                {
                    label: 'WCCILdata',
                    detail: 'Database Manager - Archive access (add suffix like SQLite)',
                },
                { label: 'WCCILdist', detail: 'Distribution Manager - Distributed systems' },
                { label: 'WCCOAapi', detail: 'API Manager - HTTP/REST interface' },
                { label: 'WCCILdriver', detail: 'Driver Manager - Hardware communication' },
                { label: 'WCCILredu', detail: 'Redundancy Manager - Failover' },
                { label: 'WCCILsim', detail: 'Simulator Manager - Simulation' },
                { label: 'WCCILproxy', detail: 'Proxy Manager - Connection proxy' },
                {
                    label: 'node',
                    detail: 'Node.js Manager - JavaScript execution (e.g., MCP Server)',
                },
                { label: 'Custom', detail: 'Enter custom manager name' },
            ];

            const typeSelection = await vscode.window.showQuickPick(managerTypes, {
                placeHolder: 'Select manager type',
                title: 'Add Manager - Step 1/4: Manager Type',
            });

            if (!typeSelection) {
                ExtensionOutputChannel.debug(
                    'ManagerTreeProvider',
                    'User cancelled at type selection',
                );
                return;
            }

            // Step 2: Determine component name
            let componentName: string;
            if (typeSelection.label === 'Custom') {
                // For custom, ask for full name
                const customName = await vscode.window.showInputBox({
                    prompt: 'Enter custom manager component name',
                    placeHolder: 'e.g., MyCustomManager',
                    title: 'Add Manager - Step 2/4: Component Name',
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'Component name cannot be empty';
                        }
                        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                            return 'Component name can only contain letters, numbers, underscore and dash';
                        }
                        return null;
                    },
                });

                if (!customName) {
                    ExtensionOutputChannel.debug(
                        'ManagerTreeProvider',
                        'User cancelled at custom name input',
                    );
                    return;
                }
                componentName = customName;
            } else {
                // For WinCC OA managers, use the full name without suffix
                componentName = typeSelection.label;
            }

            // Step 3: Select Start Mode
            const startModes = [
                { label: 'Manual', detail: 'Start manually (mode 0)', mode: 0 },
                { label: 'Once', detail: 'Start once, no restart (mode 1)', mode: 1 },
                { label: 'Always', detail: 'Auto-start on boot (mode 2)', mode: 2 },
            ];

            const modeSelection = await vscode.window.showQuickPick(startModes, {
                placeHolder: 'Select start mode',
                title: 'Add Manager - Step 3/4: Start Mode',
            });

            if (!modeSelection) {
                ExtensionOutputChannel.debug(
                    'ManagerTreeProvider',
                    'User cancelled at mode selection',
                );
                return;
            }

            // Step 4: Start Options
            // Suggest -num X for WinCC OA managers
            let defaultOptions = '';
            if (typeSelection.label !== 'Custom') {
                const existingWithSameName = managers.filter((m) => m.component === componentName);
                const nextNum = this.getNextManagerNum(existingWithSameName);
                defaultOptions = `-num ${nextNum}`;
            }

            const startOptions = await vscode.window.showInputBox({
                prompt: 'Enter start options',
                placeHolder:
                    typeSelection.label === 'node'
                        ? 'e.g., path/to/script.js'
                        : 'e.g., -num 0 -lang en_US.utf8',
                title: 'Add Manager - Step 4/4: Start Options',
                value: defaultOptions,
                validateInput: (value) => {
                    // Check if combination already exists
                    const isDuplicate = managers.some(
                        (m) =>
                            m.component === componentName &&
                            (m.startOptions || '') === (value || ''),
                    );
                    if (isDuplicate) {
                        return `Manager ${componentName} with these options already exists`;
                    }
                    return null;
                },
            });

            if (startOptions === undefined) {
                ExtensionOutputChannel.debug(
                    'ManagerTreeProvider',
                    'User cancelled at start options',
                );
                return;
            }

            // Always insert at the end
            const insertPosition = managers.length;

            // Confirmation
            const confirm = await vscode.window.showInformationMessage(
                `Add ${componentName} (${modeSelection.label} mode)?\nOptions: ${
                    startOptions || '(none)'
                }`,
                { modal: true },
                'Add Manager',
            );

            if (confirm !== 'Add Manager') {
                ExtensionOutputChannel.debug(
                    'ManagerTreeProvider',
                    'User cancelled at confirmation',
                );
                return;
            }

            // Execute insert
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Adding ${componentName}...`,
                    cancellable: false,
                },
                async () => {
                    try {
                        const options = {
                            component: componentName,
                            startMode: modeSelection.mode,
                            secondToKill: 30,
                            resetMin: 1,
                            resetStartCounter: 3,
                            startOptions: startOptions || '',
                        };

                        ExtensionOutputChannel.debug(
                            'ManagerTreeProvider',
                            `Calling insertManagerAt: ${componentName} at position ${insertPosition}`,
                        );

                        const exitCode = await this.pmon.insertManagerAt(
                            options,
                            this.currentProjectId!,
                            insertPosition,
                        );

                        ExtensionOutputChannel.debug(
                            'ManagerTreeProvider',
                            `insertManagerAt returned: ${exitCode}`,
                        );

                        if (exitCode === 0) {
                            vscode.window.showInformationMessage(
                                `✓ Manager ${componentName} added successfully`,
                            );

                            // Wait a bit for config to be written
                            await new Promise((resolve) => setTimeout(resolve, 500));

                            // Reload managers
                            ExtensionOutputChannel.debug(
                                'ManagerTreeProvider',
                                'Reloading managers after insert...',
                            );
                            await this.loadManagers();

                            // Force refresh the tree view
                            this._onDidChangeTreeData.fire();
                            ExtensionOutputChannel.info(
                                'ManagerTreeProvider',
                                `Manager ${componentName} added successfully`,
                            );
                        } else {
                            vscode.window.showErrorMessage(
                                `Failed to add manager (exit code: ${exitCode})`,
                            );
                            ExtensionOutputChannel.error(
                                'ManagerTreeProvider',
                                `insertManagerAt failed with exit code: ${exitCode}`,
                            );
                        }
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Failed to add manager: ${errorMsg}`);
                        ExtensionOutputChannel.error(
                            'ManagerTreeProvider',
                            'Error during insertManagerAt',
                            error instanceof Error ? error : new Error(String(error)),
                        );
                    }
                },
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error in add manager wizard: ${errorMsg}`);
            ExtensionOutputChannel.error(
                'ManagerTreeProvider',
                'Error in addManager wizard',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    }

    /**
     * Add a manager directly with provided parameters (for Language Model Tools / Copilot)
     */
    async addManagerDirect(options: ProjEnvManagerOptions): Promise<boolean> {
        try {
            if (!this.currentProjectId) {
                throw new Error('No active project');
            }

            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Adding manager directly: ${options.component}`,
            );

            // Get current manager list from PMON (not cached)
            const managers = await this.pmon.getManagerOptionsList(this.currentProjectId);
            const insertPosition = managers.length;

            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Calling insertManagerAt: ${options.component} at position ${insertPosition}`,
            );

            const exitCode = await this.pmon.insertManagerAt(
                options,
                this.currentProjectId,
                insertPosition,
            );

            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `insertManagerAt returned: ${exitCode}`,
            );

            if (exitCode === 0) {
                // Wait a bit for config to be written
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Reload managers
                ExtensionOutputChannel.debug(
                    'ManagerTreeProvider',
                    'Reloading managers after insert...',
                );
                await this.loadManagers();

                // Force refresh the tree view
                this._onDidChangeTreeData.fire();
                ExtensionOutputChannel.info(
                    'ManagerTreeProvider',
                    `Manager ${options.component} added successfully`,
                );
                return true;
            } else {
                ExtensionOutputChannel.error(
                    'ManagerTreeProvider',
                    `insertManagerAt failed with exit code: ${exitCode}`,
                );
                return false;
            }
        } catch (error) {
            ExtensionOutputChannel.error(
                'ManagerTreeProvider',
                'Error during addManagerDirect',
                error instanceof Error ? error : new Error(String(error)),
            );
            return false;
        }
    }

    async editManager(item: { managerData?: ManagerDisplayData }): Promise<void> {
        if (!this.currentProjectId || !item.managerData) {
            vscode.window.showErrorMessage('No manager selected');
            return;
        }

        const managerData = item.managerData;
        const currentOptions = managerData.options;

        if (!currentOptions) {
            vscode.window.showErrorMessage('Manager options not available');
            return;
        }

        // Safety check: Don't allow editing critical managers
        if (managerData.idx <= 1) {
            vscode.window.showErrorMessage('Cannot edit PMON or Data Manager (index 0-1)');
            return;
        }

        try {
            // Show settings panel and wait for result
            const updatedOptions = await ManagerSettingsPanel.show(currentOptions);

            if (!updatedOptions) {
                ExtensionOutputChannel.debug(
                    'ManagerTreeProvider',
                    'User cancelled manager settings',
                );
                return;
            }

            // Update manager: Delete old, insert new at same position
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Updating ${currentOptions.component}...`,
                    cancellable: false,
                },
                async () => {
                    try {
                        const wasRunning = managerData.info.state === ProjEnvManagerState.Running;
                        const managerIndex = managerData.idx;

                        // Stop manager if running
                        if (wasRunning) {
                            ExtensionOutputChannel.info(
                                'ManagerTreeProvider',
                                `Stopping manager ${managerIndex} for update`,
                            );
                            await this.pmon.stopManager(this.currentProjectId!, managerIndex);
                            await new Promise((resolve) => setTimeout(resolve, 5000));
                        }

                        // Delete old manager
                        ExtensionOutputChannel.info(
                            'ManagerTreeProvider',
                            `Removing old manager at index ${managerIndex}`,
                        );
                        await this.pmon.removeManager(this.currentProjectId!, managerIndex);
                        await new Promise((resolve) => setTimeout(resolve, 1000));

                        // Insert updated manager at same position
                        ExtensionOutputChannel.info(
                            'ManagerTreeProvider',
                            `Inserting updated manager at index ${managerIndex}`,
                        );
                        const exitCode = await this.pmon.insertManagerAt(
                            updatedOptions,
                            this.currentProjectId!,
                            managerIndex,
                        );

                        if (exitCode !== 0) {
                            throw new Error(`Failed to insert manager (exit code: ${exitCode})`);
                        }

                        await new Promise((resolve) => setTimeout(resolve, 1000));

                        // Restart if was running
                        if (wasRunning) {
                            ExtensionOutputChannel.info(
                                'ManagerTreeProvider',
                                `Restarting manager ${managerIndex}`,
                            );
                            await this.pmon.startManager(this.currentProjectId!, managerIndex);
                        }

                        vscode.window.showInformationMessage(
                            `✓ Manager "${currentOptions.component}" updated successfully`,
                        );

                        // Reload managers
                        await this.loadManagers();
                        this._onDidChangeTreeData.fire();
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Failed to update manager: ${errorMsg}`);
                        ExtensionOutputChannel.error(
                            'ManagerTreeProvider',
                            'Error during manager update',
                            error instanceof Error ? error : new Error(String(error)),
                        );
                    }
                },
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error in edit manager: ${errorMsg}`);
            ExtensionOutputChannel.error(
                'ManagerTreeProvider',
                'Error in editManager',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    }

    /**
     * Update manager directly with provided options (for Language Model Tools / Copilot)
     */
    async updateManagerDirect(
        managerNum: number,
        updatedOptions: Partial<ProjEnvManagerOptions>,
    ): Promise<boolean> {
        try {
            if (!this.currentProjectId) {
                throw new Error('No active project');
            }

            // Safety check
            if (managerNum <= 1) {
                throw new Error('Cannot configure PMON or Data Manager (index 0-1)');
            }

            // Get current manager
            const managerData = this.managers.find((m) => m.idx === managerNum);
            if (!managerData || !managerData.options) {
                throw new Error(`Manager ${managerNum} not found`);
            }

            // Merge updated options with current options
            const finalOptions: ProjEnvManagerOptions = {
                ...managerData.options,
                ...updatedOptions,
            };

            ExtensionOutputChannel.debug(
                'ManagerTreeProvider',
                `Updating manager ${managerNum} directly`,
            );

            const wasRunning = managerData.info.state === ProjEnvManagerState.Running;

            // Stop manager if running
            if (wasRunning) {
                ExtensionOutputChannel.info(
                    'ManagerTreeProvider',
                    `Stopping manager ${managerNum} for update`,
                );
                await this.pmon.stopManager(this.currentProjectId, managerNum);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }

            // Delete old manager
            ExtensionOutputChannel.info(
                'ManagerTreeProvider',
                `Removing old manager at index ${managerNum}`,
            );
            await this.pmon.removeManager(this.currentProjectId, managerNum);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Insert updated manager at same position
            ExtensionOutputChannel.info(
                'ManagerTreeProvider',
                `Inserting updated manager at index ${managerNum}`,
            );
            const exitCode = await this.pmon.insertManagerAt(
                finalOptions,
                this.currentProjectId,
                managerNum,
            );

            if (exitCode !== 0) {
                ExtensionOutputChannel.error(
                    'ManagerTreeProvider',
                    `Failed to insert manager (exit code: ${exitCode})`,
                );
                return false;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Restart if was running
            if (wasRunning) {
                ExtensionOutputChannel.info(
                    'ManagerTreeProvider',
                    `Restarting manager ${managerNum}`,
                );
                await this.pmon.startManager(this.currentProjectId, managerNum);
            }

            // Reload managers
            await this.loadManagers();
            this._onDidChangeTreeData.fire();

            ExtensionOutputChannel.info(
                'ManagerTreeProvider',
                `Manager ${managerNum} updated successfully`,
            );
            return true;
        } catch (error) {
            ExtensionOutputChannel.error(
                'ManagerTreeProvider',
                'Error during updateManagerDirect',
                error instanceof Error ? error : new Error(String(error)),
            );
            return false;
        }
    }

    private getNextManagerNum(
        existingManagers: Array<Pick<ProjEnvManagerOptions, 'component' | 'startOptions'>>,
    ): number {
        // Extract -num values from startOptions
        const usedNums = existingManagers
            .map((m) => {
                const options = m.startOptions || '';
                const match = options.match(/-num\s+(\d+)/);
                return match ? parseInt(match[1]) : null;
            })
            .filter((n): n is number => n !== null)
            .sort((a, b) => a - b);

        // Find first gap or return next number
        for (let i = 0; i < usedNums.length; i++) {
            if (usedNums[i] !== i) {
                return i;
            }
        }

        return usedNums.length;
    }

    // ========================================================================
    // Dev Watcher Integration
    // ========================================================================

    /**
     * Get the pmon component for use by DevWatcherService
     */
    getPmon(): PmonComponent {
        return this.pmon;
    }

    /**
     * Set the DevWatcherService instance
     */
    setDevWatcherService(service: DevWatcherService): void {
        this.devWatcherService = service;

        // Subscribe to watcher state changes
        service.onDidChangeState((state) => {
            const key = `${state.projectId}:${state.managerIndex}`;
            if (state.status === 'stopped') {
                this.watcherStates.delete(key);
            } else {
                this.watcherStates.set(key, state);
            }
            // Refresh tree view to update icons
            this._onDidChangeTreeData.fire();
        });
    }

    /**
     * Get watcher state for a manager
     */
    private getWatcherState(managerIndex: number): WatcherState | undefined {
        if (!this.currentProjectId) return undefined;
        const key = `${this.currentProjectId}:${managerIndex}`;
        return this.watcherStates.get(key);
    }

    /**
     * Toggle file watcher for a manager
     */
    async toggleWatcher(managerData: ManagerDisplayData): Promise<void> {
        if (!this.devWatcherService) {
            vscode.window.showErrorMessage('Dev Watcher service not initialized');
            return;
        }

        if (!this.currentProjectId) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        const currentProject = this.projectManager.getCurrentProject();
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        const managerType = managerData.options?.component || 'unknown';
        const isActive = this.devWatcherService.isWatcherActive(this.currentProjectId, managerData.idx);

        if (isActive) {
            // Stop watcher
            this.devWatcherService.stopWatcher(this.currentProjectId, managerData.idx);
            vscode.window.showInformationMessage(`Stopped file watcher for ${managerType}`);
        } else {
            // Check if there's a saved config, otherwise use defaults
            const savedConfig = this.devWatcherService.getSavedConfig(this.currentProjectId, managerData.idx);
            const defaultPatterns = this.devWatcherService.getDefaultPatternsForManager(managerType);

            if (!savedConfig && defaultPatterns.length === 0) {
                // No default patterns - prompt user to configure
                const configure = await vscode.window.showWarningMessage(
                    `No watch patterns configured for ${managerType}. Would you like to configure them now?`,
                    'Configure',
                    'Cancel'
                );

                if (configure === 'Configure') {
                    await this.configureWatcher(managerData);
                }
                return;
            }

            try {
                await this.devWatcherService.startWatcher(
                    this.currentProjectId,
                    managerData.idx,
                    currentProject.projectDir,
                    currentProject.version,
                    managerType,
                    savedConfig
                );
                vscode.window.showInformationMessage(`Started file watcher for ${managerType}`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to start watcher: ${errorMsg}`);
            }
        }
    }

    /**
     * Configure watch paths for a manager
     */
    async configureWatcher(managerData: ManagerDisplayData): Promise<void> {
        if (!this.devWatcherService) {
            vscode.window.showErrorMessage('Dev Watcher service not initialized');
            return;
        }

        if (!this.currentProjectId) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        const managerType = managerData.options?.component || 'unknown';

        // Get current config or defaults
        const savedConfig = this.devWatcherService.getSavedConfig(this.currentProjectId, managerData.idx);
        const defaultPatterns = this.devWatcherService.getDefaultPatternsForManager(managerType);
        const currentPaths = savedConfig?.watchPaths || defaultPatterns;

        // Build quick pick items
        const items: vscode.QuickPickItem[] = [];

        // Add current/default paths
        for (const path of currentPaths) {
            items.push({
                label: path,
                picked: true,
                description: 'Current'
            });
        }

        // Add suggested paths that aren't already included
        for (const path of defaultPatterns) {
            if (!currentPaths.includes(path)) {
                items.push({
                    label: path,
                    picked: false,
                    description: 'Suggested'
                });
            }
        }

        // Add option to add custom path
        items.push({
            label: '$(add) Add custom path...',
            description: 'Enter a custom glob pattern'
        });

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: `Select watch paths for ${managerType}`,
            title: 'Configure Watch Paths'
        });

        if (!selected) {
            return;
        }

        // Check if user wants to add custom path
        const addCustom = selected.find(s => s.label.includes('Add custom path'));
        let watchPaths = selected
            .filter(s => !s.label.includes('Add custom path'))
            .map(s => s.label);

        if (addCustom) {
            const customPath = await vscode.window.showInputBox({
                prompt: 'Enter custom watch path (glob pattern)',
                placeHolder: 'e.g., scripts/**/*.ctl or javascript/**/*.ts',
                title: 'Add Custom Watch Path'
            });

            if (customPath) {
                watchPaths.push(customPath);
            }
        }

        if (watchPaths.length === 0) {
            vscode.window.showWarningMessage('No watch paths selected');
            return;
        }

        // Save the configuration
        const currentProject = this.projectManager.getCurrentProject();
        if (!currentProject) {
            return;
        }

        // If watcher is active, restart with new config
        const isActive = this.devWatcherService.isWatcherActive(this.currentProjectId, managerData.idx);

        if (isActive) {
            this.devWatcherService.stopWatcher(this.currentProjectId, managerData.idx);
        }

        try {
            await this.devWatcherService.startWatcher(
                this.currentProjectId,
                managerData.idx,
                currentProject.projectDir,
                currentProject.version,
                managerType,
                { watchPaths }
            );

            vscode.window.showInformationMessage(
                `Watch paths configured for ${managerType}: ${watchPaths.length} pattern(s)`
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to apply configuration: ${errorMsg}`);
        }
    }
}

class ManagerItem extends vscode.TreeItem {
    public readonly managerData?: ManagerDisplayData;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'folder' | 'manager' | 'info',
        public readonly status?: string,
        managerData?: ManagerDisplayData,
        startOptions?: string,
        watcherState?: WatcherState
    ) {
        super(label, collapsibleState);

        this.managerData = managerData;

        if (itemType === 'manager' && managerData) {
            this.id = `manager-${managerData.idx}`;
        }

        if (itemType === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'managerFolder';
            this.description = status;
        } else if (itemType === 'manager' && managerData) {
            const info = managerData.info;

            // Build description with watcher indicator
            let desc = '';
            let watcherIndicator = '';

            if (watcherState) {
                switch (watcherState.status) {
                    case 'watching':
                        watcherIndicator = '👁 ';
                        break;
                    case 'restarting':
                        watcherIndicator = '🔄 ';
                        break;
                    case 'error':
                        watcherIndicator = '⚠️ ';
                        break;
                }
            }

            if (info.state === ProjEnvManagerState.Running) {
                this.iconPath = new vscode.ThemeIcon(
                    'circle-filled',
                    new vscode.ThemeColor('testing.iconPassed'),
                );
                desc = startOptions
                    ? `${startOptions} (PID: ${info.pid})`
                    : `PID: ${info.pid}`;
            } else if (info.state === ProjEnvManagerState.NotRunning) {
                this.iconPath = new vscode.ThemeIcon(
                    'circle-outline',
                    new vscode.ThemeColor('testing.iconFailed'),
                );
                desc = startOptions || status || '';
            } else if (info.state === ProjEnvManagerState.Init) {
                this.iconPath = new vscode.ThemeIcon(
                    'loading~spin',
                    new vscode.ThemeColor('testing.iconQueued'),
                );
                desc = startOptions || status || '';
            } else {
                this.iconPath = new vscode.ThemeIcon(
                    'warning',
                    new vscode.ThemeColor('testing.iconErrored'),
                );
                desc = startOptions || status || '';
            }

            this.description = watcherIndicator + desc;

            // Set contextValue based on watcher state for different menu options
            if (watcherState && watcherState.status !== 'stopped') {
                this.contextValue = 'manager-watching';
            } else {
                this.contextValue = 'manager';
            }

            // Build tooltip
            let tooltipText = `${this.label} - ${status}\nManager Index: ${managerData.idx}`;
            tooltipText += `\nPID: ${info.pid}`;
            tooltipText += `\nStart Mode: ${info.startMode}`;
            if (startOptions) {
                tooltipText += `\nOptions: ${startOptions}`;
            }
            if (info.startTime) {
                tooltipText += `\nStart Time: ${info.startTime}`;
            }

            // Add watcher info to tooltip
            if (watcherState) {
                tooltipText += `\n\n--- File Watcher ---`;
                tooltipText += `\nStatus: ${watcherState.status}`;
                if (watcherState.watchedFileCount) {
                    tooltipText += `\nFiles watched: ${watcherState.watchedFileCount}`;
                }
                if (watcherState.lastChange) {
                    tooltipText += `\nLast change: ${new Date(watcherState.lastChange).toLocaleTimeString()}`;
                }
                if (watcherState.lastRestart) {
                    tooltipText += `\nLast restart: ${new Date(watcherState.lastRestart).toLocaleTimeString()}`;
                }
                if (watcherState.error) {
                    tooltipText += `\nError: ${watcherState.error}`;
                }
            }

            this.tooltip = tooltipText;
        } else if (itemType === 'info') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.description = status;
            this.contextValue = 'info';
        }
    }
}
