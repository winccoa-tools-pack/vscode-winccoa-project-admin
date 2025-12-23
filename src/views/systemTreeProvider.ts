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
            // Root level - show system status based on current project
            const currentProject = this.projectManager.getCurrentProject();
            const isRunning = currentProject?.isRunning || false;
            
            const statusDescription = isRunning ? '● Running' : '○ Stopped';
            const statusTooltip = currentProject 
                ? `System status for ${currentProject.name}: ${isRunning ? 'Running' : 'Stopped'}`
                : 'No project selected';
            
            return [
                new SystemItem(
                    'System Status',
                    vscode.TreeItemCollapsibleState.None,
                    'systemStatus',
                    statusDescription,
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
                    'project',
                    project.isRunning ? '● Running' : '○ Stopped',
                    `Project: ${project.name}`,
                    project.isRunning,
                    project.projectDir,
                    project
                )
            );
        }
        return [];
    }

    async startProject(project: any): Promise<void> {
        if (!project || !project.id) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        try {
            vscode.window.showInformationMessage(`⟳ Starting ${project.name}...`);
            
            const result = await this.pmon.startProject(project.id, true);
            
            if (result === 0) {
                vscode.window.showInformationMessage(`✓ ${project.name} started successfully`);
                await this.projectManager.refreshProjects();
                this.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to start ${project.name} (error code: ${result})`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start project: ${error}`);
        }
    }

    async stopProject(project: any): Promise<void> {
        if (!project || !project.id) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to stop ${project.name}?`,
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage(`⏹ Stopping ${project.name}...`);
                
                const result = await this.pmon.stopProject(project.id);
                
                if (result === 0) {
                    vscode.window.showInformationMessage(`✓ ${project.name} stopped`);
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(`Failed to stop ${project.name} (error code: ${result})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop project: ${error}`);
            }
        }
    }

    async restartProject(project: any): Promise<void> {
        if (!project || !project.id) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to restart ${project.name}?`,
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage(`⟳ Restarting ${project.name}...`);
                
                const result = await this.pmon.restartProject(project.id);
                
                if (result === 0) {
                    vscode.window.showInformationMessage(`✓ ${project.name} restarted successfully`);
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(`Failed to restart ${project.name} (error code: ${result})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restart project: ${error}`);
            }
        }
    }

    async startOASystem(): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();
        
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        try {
            vscode.window.showInformationMessage(`⟳ Starting PMON for ${currentProject.name}...`);
            
            const result = await this.pmon.startPmonOnly(currentProject.id);
            
            if (result === 0) {
                vscode.window.showInformationMessage(`✓ PMON started for ${currentProject.name}`);
                // Refresh to update status
                await this.projectManager.refreshProjects();
                this.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to start PMON (error code: ${result})`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start PMON: ${error}`);
        }
    }

    async stopOASystem(): Promise<void> {
        const currentProject = this.projectManager.getCurrentProject();
        
        if (!currentProject) {
            vscode.window.showErrorMessage('No project selected');
            return;
        }

        const answer = await vscode.window.showWarningMessage(
            `Stop PMON and all managers for ${currentProject.name}?`,
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage(`⏹ Stopping PMON for ${currentProject.name}...`);
                
                const result = await this.pmon.stopProjectAndPmon(currentProject.id);
                
                if (result === 0) {
                    vscode.window.showInformationMessage(`✓ PMON stopped for ${currentProject.name}`);
                    // Refresh to update status
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(`Failed to stop PMON (error code: ${result})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop PMON: ${error}`);
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
            `Restart PMON for ${currentProject.name}?`,
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage(`⟳ Restarting PMON for ${currentProject.name}...`);
                
                // Stop PMON first
                await this.pmon.stopProjectAndPmon(currentProject.id);
                
                // Wait a moment
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Start PMON again
                const result = await this.pmon.startPmonOnly(currentProject.id);
                
                if (result === 0) {
                    vscode.window.showInformationMessage(`✓ PMON restarted for ${currentProject.name}`);
                    // Refresh to update status
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(`Failed to restart PMON (error code: ${result})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restart PMON: ${error}`);
            }
        }
    }
}

class SystemItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'systemStatus' | 'projectInfo' | 'info' | 'projects' | 'project',
        public readonly description?: string,
        public readonly tooltipText?: string,
        public readonly isRunning?: boolean,
        public readonly projectPath?: string,
        public readonly projectData?: any
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
        } else if (itemType === 'project') {
            if (isRunning) {
                this.iconPath = new vscode.ThemeIcon('server-process', new vscode.ThemeColor('testing.iconPassed'));
            } else {
                this.iconPath = new vscode.ThemeIcon('server', new vscode.ThemeColor('testing.iconFailed'));
            }
            this.contextValue = 'project';
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
