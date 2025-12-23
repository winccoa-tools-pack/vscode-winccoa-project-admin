import * as vscode from 'vscode';
import { ProjectManager } from '../projectManager';
import { PmonComponent, ProjEnvManagerInfo, ProjEnvManagerState, ProjEnvManagerOptions } from '@winccoa-tools-pack/core-utils';

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
        this.loadManagers();
        
        this.pollInterval = setInterval(() => {
            this.loadManagers();
        }, 5000); // Poll every 5 seconds
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
            this._onDidChangeTreeData.fire();
            return;
        }

        try {
            this.currentProjectId = currentProject.id;

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
            console.error('Failed to load managers:', error);
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
