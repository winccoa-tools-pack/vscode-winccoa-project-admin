import * as vscode from 'vscode';
import { ProjectManager } from '../projectManager';
import { PmonComponent, ProjEnvManagerInfo, ProjEnvManagerState, ProjEnvManagerOptions } from '@winccoa-tools-pack/npm-winccoa-core';
import { ExtensionOutputChannel } from '../extensionOutput';

interface ManagerDisplayData {
    idx: number;
    info: ProjEnvManagerInfo;
    options?: ProjEnvManagerOptions;
}

export class ManagerTreeProvider implements vscode.TreeDataProvider<ManagerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ManagerItem | undefined | null | void> = new vscode.EventEmitter<ManagerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ManagerItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private managers: ManagerDisplayData[] = [];
    private pollInterval: NodeJS.Timeout | undefined;
    private pmon: PmonComponent = new PmonComponent();
    private currentProjectId: string | undefined;

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
            this.loadManagers().catch(err => {
                ExtensionOutputChannel.error('ManagerTreeProvider', 'Load failed', err instanceof Error ? err : new Error(String(err)));
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

            // Set WinCC OA version for pmon component
            this.pmon.setVersion(currentProject.version);

            // Get project status with manager info
            const projectStatus = await this.pmon.getProjectStatus(currentProject.id);
            
            // Get manager options (component names, start modes, etc.)
            const managerOptions = await this.pmon.getManagerOptionsList(currentProject.id);
            
            if (projectStatus && projectStatus.managers) {
                this.managers = projectStatus.managers
                    .map((info, idx) => ({
                        idx,
                        info,
                        options: managerOptions[idx]
                    }))
                    .filter(m => m.idx > 0); // Skip pmon itself (idx 0)
            } else {
                this.managers = [];
            }
            
            this._onDidChangeTreeData.fire();
        } catch (error) {
            ExtensionOutputChannel.error('ManagerTreeProvider', 'Failed to load managers', error instanceof Error ? error : new Error(String(error)));
            this.managers = [];
            this._onDidChangeTreeData.fire();
        }
    }

    refresh(): void {
        this.loadManagers();
    }

    getTreeItem(element: ManagerItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ManagerItem): Promise<ManagerItem[]> {
        if (!element) {
            const currentProject = this.projectManager.getCurrentProject();
            
            if (!currentProject) {
                return [
                    new ManagerItem('No project selected', vscode.TreeItemCollapsibleState.None, 'info', 'Select a project from status bar', undefined)
                ];
            }
            
            // Check if project is running
            if (!currentProject.isRunning) {
                return [
                    new ManagerItem('Project not running', vscode.TreeItemCollapsibleState.None, 'info', 'Start the project to see managers', undefined)
                ];
            }
            
            // Root level - show Managers folder
            const managerCount = this.managers.length > 0 ? `${this.managers.length} managers` : 'No managers';
            return [
                new ManagerItem('Managers', vscode.TreeItemCollapsibleState.Expanded, 'folder', managerCount, undefined)
            ];
        } else if (element.label === 'Managers' && element.itemType === 'folder') {
            // Show all managers
            if (this.managers.length === 0) {
                return [
                    new ManagerItem('No managers found', vscode.TreeItemCollapsibleState.None, 'info', 'Check project configuration', undefined)
                ];
            }
            
            return this.managers.map(mgr => {
                const componentName = mgr.options?.component || 'Unknown';
                const startOptions = mgr.options?.startOptions || '';
                
                return new ManagerItem(
                    componentName,
                    vscode.TreeItemCollapsibleState.None, 
                    'manager', 
                    this.getStatusText(mgr.info.state),
                    mgr,
                    startOptions
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
            const stopResult = await this.pmon.stopManager(this.currentProjectId, managerData.idx);
            if (stopResult !== 0) {
                vscode.window.showErrorMessage(`Failed to stop manager (error code: ${stopResult})`);
                return;
            }
            
            // Wait a bit before starting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const startResult = await this.pmon.startManager(this.currentProjectId, managerData.idx);
            if (startResult === 0) {
                vscode.window.showInformationMessage(`✓ Manager restarted successfully`);
            } else {
                vscode.window.showErrorMessage(`Failed to restart manager (error code: ${startResult})`);
            }
            
            await this.loadManagers();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to restart manager: ${error}`);
        }
    }

    async addManager(): Promise<void> {
        if (!this.currentProjectId) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        try {
            // Get current managers to detect existing numbers
            const managers = await this.pmon.getManagerOptionsList(this.currentProjectId);

            // Step 1: Select Manager Type
            const managerTypes = [
                { label: 'CTRL', detail: 'Control Manager - Script execution' },
                { label: 'UI', detail: 'User Interface Manager - Panels and HMI' },
                { label: 'EVENT', detail: 'Event Manager - Alarm handling' },
                { label: 'DB', detail: 'Database Manager - Archive access' },
                { label: 'DIST', detail: 'Distribution Manager - Distributed systems' },
                { label: 'API', detail: 'API Manager - HTTP/REST interface' },
                { label: 'DRIVER', detail: 'Driver Manager - Hardware communication' },
                { label: 'REDU', detail: 'Redundancy Manager - Failover' },
            ];

            const typeSelection = await vscode.window.showQuickPick(managerTypes, {
                placeHolder: 'Select manager type',
                title: 'Add Manager - Step 1/5: Manager Type'
            });

            if (!typeSelection) {
                ExtensionOutputChannel.debug('ManagerTreeProvider', 'User cancelled at type selection');
                return;
            }

            // Step 2: Find next free number and get manager number
            const nextFree = this.getNextFreeNumber(managers, typeSelection.label);
            const managerNum = await vscode.window.showInputBox({
                prompt: `Enter manager number for ${typeSelection.label}`,
                placeHolder: `Next available: ${nextFree}`,
                value: nextFree.toString(),
                title: 'Add Manager - Step 2/5: Manager Number',
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 0) {
                        return 'Please enter a valid number >= 0';
                    }
                    const componentName = `${typeSelection.label}_${num}`;
                    if (managers.some(m => m.component === componentName)) {
                        return `Manager ${componentName} already exists`;
                    }
                    return null;
                }
            });

            if (!managerNum) {
                ExtensionOutputChannel.debug('ManagerTreeProvider', 'User cancelled at number input');
                return;
            }

            const componentName = `${typeSelection.label}_${managerNum}`;

            // Step 3: Select Start Mode
            const startModes = [
                { label: 'Manual', detail: 'Start manually (mode 0)', mode: 0 },
                { label: 'Always', detail: 'Auto-start on boot (mode 1)', mode: 1 },
                { label: 'Once', detail: 'Start once, no restart (mode 2)', mode: 2 }
            ];

            const modeSelection = await vscode.window.showQuickPick(startModes, {
                placeHolder: 'Select start mode',
                title: 'Add Manager - Step 3/5: Start Mode'
            });

            if (!modeSelection) {
                ExtensionOutputChannel.debug('ManagerTreeProvider', 'User cancelled at mode selection');
                return;
            }

            // Step 4: Start Options (optional)
            const startOptions = await vscode.window.showInputBox({
                prompt: 'Enter start options (optional)',
                placeHolder: 'e.g. -num 0 -lang en_US.utf8 (leave empty for defaults)',
                title: 'Add Manager - Step 4/5: Start Options',
                value: ''
            });

            if (startOptions === undefined) {
                ExtensionOutputChannel.debug('ManagerTreeProvider', 'User cancelled at start options');
                return;
            }

            // Step 5: Insert Position
            const positionItems = [
                { label: 'At beginning', detail: 'Insert as first manager', index: 0 },
                { label: 'At end', detail: `Append after all managers (position ${managers.length})`, index: managers.length },
                ...managers.map((m, idx) => ({
                    label: `After ${m.component}`,
                    detail: m.startOptions || 'No start options',
                    index: idx + 1
                }))
            ];

            const positionSelection = await vscode.window.showQuickPick(positionItems, {
                placeHolder: 'Select insert position',
                title: 'Add Manager - Step 5/5: Position'
            });

            if (!positionSelection) {
                ExtensionOutputChannel.debug('ManagerTreeProvider', 'User cancelled at position selection');
                return;
            }

            // Confirmation
            const confirm = await vscode.window.showInformationMessage(
                `Add ${componentName} (${modeSelection.label} mode) at position ${positionSelection.index}?`,
                { modal: true },
                'Add Manager'
            );

            if (confirm !== 'Add Manager') {
                ExtensionOutputChannel.debug('ManagerTreeProvider', 'User cancelled at confirmation');
                return;
            }

            // Execute insert
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Adding ${componentName}...`,
                cancellable: false
            }, async () => {
                try {
                    const options = {
                        component: componentName,
                        startMode: modeSelection.mode,
                        secondToKill: 30,
                        resetStartCounter: 1,
                        restart: 0,
                        startOptions: startOptions || ''
                    };

                    ExtensionOutputChannel.debug('ManagerTreeProvider', `Calling insertManagerAt: ${componentName} at position ${positionSelection.index}`);

                    const exitCode = await this.pmon.insertManagerAt(
                        options,
                        this.currentProjectId!,
                        positionSelection.index
                    );

                    ExtensionOutputChannel.debug('ManagerTreeProvider', `insertManagerAt returned: ${exitCode}`);

                    if (exitCode === 0) {
                        vscode.window.showInformationMessage(`✓ Manager ${componentName} added successfully`);
                        
                        // Wait a bit for config to be written
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Reload managers
                        ExtensionOutputChannel.debug('ManagerTreeProvider', 'Reloading managers after insert...');
                        await this.loadManagers();
                        
                        // Force refresh the tree view
                        this._onDidChangeTreeData.fire();
                        ExtensionOutputChannel.info('ManagerTreeProvider', `Manager ${componentName} added successfully`);
                    } else {
                        vscode.window.showErrorMessage(`Failed to add manager (exit code: ${exitCode})`);
                        ExtensionOutputChannel.error('ManagerTreeProvider', `insertManagerAt failed with exit code: ${exitCode}`);
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Failed to add manager: ${errorMsg}`);
                    ExtensionOutputChannel.error('ManagerTreeProvider', 'Error during insertManagerAt', error instanceof Error ? error : new Error(String(error)));
                }
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error in add manager wizard: ${errorMsg}`);
            ExtensionOutputChannel.error('ManagerTreeProvider', 'Error in addManager wizard', error instanceof Error ? error : new Error(String(error)));
        }
    }

    private getNextFreeNumber(managers: any[], managerType: string): number {
        const existingNumbers = managers
            .filter(m => m.component.startsWith(managerType + '_'))
            .map(m => {
                const parts = m.component.split('_');
                return parseInt(parts[parts.length - 1]);
            })
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);

        // Find first gap or return next number
        for (let i = 0; i < existingNumbers.length; i++) {
            if (existingNumbers[i] !== i) {
                return i;
            }
        }

        return existingNumbers.length;
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
        startOptions?: string
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
            
            if (info.state === ProjEnvManagerState.Running) {
                this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
                const desc = startOptions ? `${startOptions} (PID: ${info.pid})` : `PID: ${info.pid}`;
                this.description = desc;
            } else if (info.state === ProjEnvManagerState.NotRunning) {
                this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconFailed'));
                this.description = startOptions || status;
            } else if (info.state === ProjEnvManagerState.Init) {
                this.iconPath = new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('testing.iconQueued'));
                this.description = startOptions || status;
            } else {
                this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconErrored'));
                this.description = startOptions || status;
            }
            
            this.contextValue = 'manager';
            
            let tooltipText = `${this.label} - ${status}\nManager Index: ${managerData.idx}`;
            tooltipText += `\nPID: ${info.pid}`;
            tooltipText += `\nStart Mode: ${info.startMode}`;
            if (startOptions) {
                tooltipText += `\nOptions: ${startOptions}`;
            }
            if (info.startTime) {
                tooltipText += `\nStart Time: ${info.startTime}`;
            }
            this.tooltip = tooltipText;
        } else if (itemType === 'info') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.description = status;
            this.contextValue = 'info';
        }
    }
}
