import * as vscode from 'vscode';
import { ProjectManager } from '../projectManager';
import { ProjEnvProject } from '@winccoa-tools-pack/core-utils';

interface ManagerData {
    idx: number;
    type: string;
    status: number;     // 0=stopped, 2=running
    pid: number | null;
    options?: string;
}

export class ManagerTreeProvider implements vscode.TreeDataProvider<ManagerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ManagerItem | undefined | null | void> = new vscode.EventEmitter<ManagerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ManagerItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private managers: ManagerData[] = [];
    private pollInterval: NodeJS.Timeout | undefined;
    private currentProjEnv: ProjEnvProject | undefined;

    constructor(private projectManager: ProjectManager) {
        // Start polling for manager status
        this.startPolling();
        
        // Refresh when project changes
        this.projectManager.onDidChangeProject(() => {
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
            this.currentProjEnv = undefined;
            this._onDidChangeTreeData.fire();
            return;
        }

        try {
            // Create ProjEnvProject instance from current project
            const projEnv = new ProjEnvProject();
            // TODO: Initialize from currentProject data
            // For now, we'll show a placeholder until we implement proper manager control
            
            this.managers = [];
            this.currentProjEnv = projEnv;
            
            this._onDidChangeTreeData.fire();
        } catch (error) {
            console.error('Failed to load managers:', error);
            this.managers = [];
            this.currentProjEnv = undefined;
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
                    new ManagerItem('No project selected', vscode.TreeItemCollapsibleState.None, 'info', 'Select a project from status bar', undefined, undefined, undefined)
                ];
            }
            
            // Root level - show Managers folder
            const managerCount = this.managers.length > 0 ? `${this.managers.length} managers` : 'Loading...';
            return [
                new ManagerItem('Managers', vscode.TreeItemCollapsibleState.Expanded, 'folder', managerCount, undefined, undefined, undefined)
            ];
        } else if (element.label === 'Managers' && element.itemType === 'folder') {
            // Show all managers
            if (this.managers.length === 0) {
                return [
                    new ManagerItem('Manager control coming soon', vscode.TreeItemCollapsibleState.None, 'info', 'Will be implemented with direct pmon integration', undefined, undefined, undefined)
                ];
            }
            
            return this.managers.map(mgr => 
                new ManagerItem(
                    mgr.type,
                    vscode.TreeItemCollapsibleState.None, 
                    'manager', 
                    this.getStatusText(mgr.status),
                    mgr.idx,
                    mgr.pid,
                    mgr.options
                )
            );
        }
        return [];
    }

    private getStatusText(status: number): string {
        return status === 2 ? 'running' : 'stopped';
    }

    async startManager(managerIdx: number): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();
        
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        // TODO: Implement with direct pmon communication
        vscode.window.showWarningMessage('Manager control coming soon - will be implemented with direct pmon integration');
    }

    async stopManager(managerIdx: number): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();
        
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        // TODO: Implement with direct pmon communication
        vscode.window.showWarningMessage('Manager control coming soon - will be implemented with direct pmon integration');
    }

    async restartManager(managerIdx: number): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();
        
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        // TODO: Implement with direct pmon communication
        vscode.window.showWarningMessage('Manager control coming soon - will be implemented with direct pmon integration');
    }
}

class ManagerItem extends vscode.TreeItem {
    public readonly managerIdx?: number;
    
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'folder' | 'manager' | 'info',
        public readonly status?: string,
        managerIdx?: number,
        public readonly pid?: number | null,
        public readonly options?: string
    ) {
        super(label, collapsibleState);
        
        this.managerIdx = managerIdx;
        
        if (itemType === 'manager' && managerIdx !== undefined) {
            this.id = `manager-${managerIdx}`;
        }
        
        if (itemType === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'managerFolder';
            this.description = status;
        } else if (itemType === 'manager') {
            if (status === 'running') {
                this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
                if (options && options.trim()) {
                    this.description = `${options}${pid ? ` (PID: ${pid})` : ''}`;
                } else {
                    this.description = pid ? `(PID: ${pid})` : '';
                }
            } else if (status === 'stopped') {
                this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconFailed'));
                if (options && options.trim()) {
                    this.description = options;
                } else {
                    this.description = '';
                }
            }
            this.contextValue = 'manager';
            
            let tooltipText = `${this.label} - ${status}`;
            if (options && options.trim()) {
                tooltipText += `\nOptions: ${options}`;
            }
            if (pid) {
                tooltipText += `\nPID: ${pid}`;
            }
            this.tooltip = tooltipText;
        } else if (itemType === 'info') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.description = status;
            this.contextValue = 'info';
        }
    }
}
