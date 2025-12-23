import * as vscode from 'vscode';
import { ProjectManager } from '../projectManager';
import { PmonComponent } from '@winccoa-tools-pack/core-utils';
import type { ProjectInfo } from '../types';

export class SystemTreeProvider implements vscode.TreeDataProvider<SystemItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SystemItem | undefined | null | void> = new vscode.EventEmitter<SystemItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SystemItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private pmon: PmonComponent = new PmonComponent();

    constructor(private projectManager: ProjectManager) {
        // Subscribe to project changes
        this.projectManager.onDidChangeProject(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SystemItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SystemItem): Promise<SystemItem[]> {
        if (!element) {
            const currentProject = this.projectManager.getCurrentProject();
            const isRunning = currentProject?.isRunning || false;
            
            const statusLabel = 'WinCC OA System';
            const statusDesc = isRunning ? '● Online' : '○ Offline';
            const statusTooltip = isRunning ? 'System is operational' : 'System is not running';
            
            return [
                new SystemItem(
                    statusLabel, 
                    vscode.TreeItemCollapsibleState.None, 
                    'systemStatus', 
                    statusDesc,
                    statusTooltip,
                    isRunning
                ),
                new SystemItem(
                    'Project Information',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'projectInfo',
                    undefined,
                    'WinCC OA Project Details',
                    undefined
                ),
                new SystemItem(
                    'Projects',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'projects',
                    undefined,
                    'Main Project and Subprojects',
                    undefined
                )
            ];
        } else if (element.itemType === 'projectInfo') {
            const currentProject = this.projectManager.getCurrentProject();
            
            if (currentProject) {
                return [
                    new SystemItem('Project Name', vscode.TreeItemCollapsibleState.None, 'info', currentProject.name, undefined, undefined),
                    new SystemItem('Version', vscode.TreeItemCollapsibleState.None, 'info', currentProject.version || 'N/A', undefined, undefined),
                    new SystemItem('Project Path', vscode.TreeItemCollapsibleState.None, 'info', currentProject.projectDir, undefined, undefined),
                    new SystemItem('Install Path', vscode.TreeItemCollapsibleState.None, 'info', currentProject.oaInstallPath, undefined, undefined)
                ];
            } else {
                return [
                    new SystemItem('No project selected', vscode.TreeItemCollapsibleState.None, 'info', 'Select a project from status bar', undefined, undefined)
                ];
            }
        } else if (element.itemType === 'projects') {
            const runningProjects = await this.projectManager.getRunningProjects();
            
            if (runningProjects.length === 0) {
                return [
                    new SystemItem('No running projects', vscode.TreeItemCollapsibleState.None, 'info', 'Start a project to see it here', undefined, undefined)
                ];
            }
            
            return runningProjects.map(project => 
                new SystemItem(
                    project.name,
                    vscode.TreeItemCollapsibleState.None,
                    'projectPath',
                    project.isRunning ? '● Running' : '○ Stopped',
                    `Open in Explorer: ${project.projectDir}`,
                    undefined,
                    project.projectDir
                )
            );
        }
        return [];
    }

    async startOASystem(): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();
        
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        try {
            vscode.window.showInformationMessage('⟳ Starting WinCC OA System...');
            
            const result = await this.pmon.startProject(currentProject.id, true);
            
            if (result === 0) {
                vscode.window.showInformationMessage('✓ WinCC OA System started successfully');
                // Refresh to update status
                await this.projectManager.refreshProjects();
                this.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to start system (error code: ${result})`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start system: ${error}`);
        }
    }

    async stopOASystem(): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();
        
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        const answer = await vscode.window.showWarningMessage(
            'Are you sure you want to stop the WinCC OA System?',
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage('⏹ Stopping WinCC OA System...');
                
                const result = await this.pmon.stopProject(currentProject.id);
                
                if (result === 0) {
                    vscode.window.showInformationMessage('✓ WinCC OA System stopped');
                    // Refresh to update status
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(`Failed to stop system (error code: ${result})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop system: ${error}`);
            }
        }
    }

    async restartOASystem(): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();
        
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        const answer = await vscode.window.showWarningMessage(
            'Are you sure you want to restart the WinCC OA System?',
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage('⟳ Restarting WinCC OA System...');
                
                const result = await this.pmon.restartProject(currentProject.id);
                
                if (result === 0) {
                    vscode.window.showInformationMessage('✓ WinCC OA System restarted successfully');
                    // Refresh to update status
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(`Failed to restart system (error code: ${result})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restart system: ${error}`);
            }
        }
    }
}

class SystemItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'systemStatus' | 'projectInfo' | 'info' | 'projects' | 'projectPath',
        public readonly description?: string,
        public readonly tooltipText?: string,
        public readonly isRunning?: boolean,
        public readonly projectPath?: string
    ) {
        super(label, collapsibleState);
        
        if (itemType === 'systemStatus') {
            if (isRunning) {
                this.iconPath = new vscode.ThemeIcon('pulse', new vscode.ThemeColor('testing.iconPassed'));
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('testing.iconFailed'));
            }
            this.contextValue = 'systemStatus';
            this.tooltip = tooltipText;
            this.description = description;
        } else if (itemType === 'projectInfo') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'projectInfo';
            this.tooltip = tooltipText;
        } else if (itemType === 'projects') {
            this.iconPath = new vscode.ThemeIcon('folder-library');
            this.contextValue = 'projects';
            this.tooltip = tooltipText;
        } else if (itemType === 'projectPath') {
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'projectPath';
            this.tooltip = tooltipText;
            this.description = description;
            if (projectPath) {
                this.command = {
                    command: 'revealFileInOS',
                    title: 'Open in Explorer',
                    arguments: [vscode.Uri.file(projectPath)]
                };
            }
        } else if (itemType === 'info') {
            this.iconPath = new vscode.ThemeIcon('symbol-property');
            this.contextValue = 'infoItem';
            this.description = description;
        }
    }
}
