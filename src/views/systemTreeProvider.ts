import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectManager } from '../projectManager';
import { PmonComponent } from '@winccoa-tools-pack/npm-winccoa-core';
import { ProjEnvPmonStatus } from '@winccoa-tools-pack/npm-winccoa-core';
import type { ProjectInfo } from '../types';
import { ExtensionOutputChannel } from '../extensionOutput';

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
            
            // Set version if we have a current project
            if (currentProject) {
                this.pmon.setVersion(currentProject.version);
            }
            
            // If no projects loaded yet, show loading state
            if (!currentProject && this.projectManager.getRunningProjects().length === 0) {
                // Check if we have any runnable projects yet
                try {
                    const all = await this.projectManager.getAllRunnableProjects();
                    if (all.length === 0) {
                        return [
                            new SystemItem(
                                'Loading projects...',
                                vscode.TreeItemCollapsibleState.None,
                                'info',
                                'Initializing',
                                'Please wait...',
                                undefined
                            )
                        ];
                    }
                } catch (err) {
                    // Still loading
                }
            }
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
                const items = [
                    new SystemItem('Project Name', vscode.TreeItemCollapsibleState.None, 'info', currentProject.name, undefined, undefined, undefined, undefined, undefined),
                    new SystemItem('Version', vscode.TreeItemCollapsibleState.None, 'info', currentProject.version || 'N/A', undefined, undefined, undefined, undefined, undefined),
                    new SystemItem('Project Path', vscode.TreeItemCollapsibleState.None, 'info', currentProject.projectDir, undefined, undefined, undefined, undefined, undefined),
                    new SystemItem('Install Path', vscode.TreeItemCollapsibleState.None, 'info', currentProject.oaInstallPath, undefined, undefined, undefined, undefined, undefined)
                ];

                // Parse and add subprojects
                const subProjects = this.parseSubProjects(currentProject);
                if (subProjects.length > 0) {
                    items.push(
                        new SystemItem(
                            'Subprojects',
                            vscode.TreeItemCollapsibleState.Collapsed,
                            'subprojects',
                            `${subProjects.length} subproject(s)`,
                            'Linked subprojects',
                            undefined,
                            undefined,
                            subProjects,
                            undefined
                        )
                    );
                }

                return items;
            } else {
                return [
                    new SystemItem('No project selected', vscode.TreeItemCollapsibleState.None, 'info', 'Select a project from status bar', undefined, undefined, undefined, undefined, undefined)
                ];
            }
        } else if (element.itemType === 'subprojects') {
            // Display subprojects stored in projectData
            const subProjects = element.projectData || [];
            return subProjects.map((subProj: string) => {
                const baseName = path.basename(subProj);
                return new SystemItem(
                    baseName,
                    vscode.TreeItemCollapsibleState.None,
                    'subproject',
                    subProj,
                    `Subproject path: ${subProj}`,
                    undefined,
                    subProj,
                    undefined,
                    subProj
                );
            });
        } else if (element.itemType === 'projects') {
            const allProjects = await this.projectManager.getAllRunnableProjects();
            
            if (allProjects.length === 0) {
                return [
                    new SystemItem('No projects found', vscode.TreeItemCollapsibleState.None, 'info', 'Register a project first', undefined, undefined, undefined, undefined, undefined)
                ];
            }
            
            return allProjects.map(project => 
                new SystemItem(
                    project.name,
                    vscode.TreeItemCollapsibleState.None,
                    'project',
                    project.isRunning ? '● Running' : '○ Stopped',
                    `Project: ${project.name}`,
                    project.isRunning,
                    project.projectDir,
                    project,
                    undefined // subprojectPath not needed for projects
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
            // Set WinCC OA version for pmon component
            ExtensionOutputChannel.debug('SystemTreeProvider', `Setting WinCC OA version: ${project.version}`);
            this.pmon.setVersion(project.version);
            
            vscode.window.showInformationMessage(`⟳ Starting ${project.name}...`);
            
            // Step 1: Check if PMON is running
            ExtensionOutputChannel.debug('SystemTreeProvider', `Checking PMON status for project: ${project.id}`);
            const pmonStatus = await this.pmon.getStatus(project.id);
            ExtensionOutputChannel.debug('SystemTreeProvider', `PMON status: ${pmonStatus}`);
            
            if (pmonStatus !== ProjEnvPmonStatus.Running) {
                // Step 2: PMON not running - start it first
                vscode.window.showInformationMessage(`⟳ Starting PMON for ${project.name}...`);
                ExtensionOutputChannel.info('SystemTreeProvider', `Starting PMON for project: ${project.id}`);
                const pmonResult = await this.pmon.startPmonOnly(project.id);
                
                if (pmonResult !== 0) {
                    vscode.window.showErrorMessage(`Failed to start PMON (error code: ${pmonResult})`);
                    return;
                }
                
                // Wait a moment for PMON to initialize
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Step 3: Now start all managers
            ExtensionOutputChannel.info('SystemTreeProvider', `Starting all managers for project: ${project.id}`);
            const result = await this.pmon.startProject(project.id, true);
            
            if (result === 0) {
                vscode.window.showInformationMessage(`✓ ${project.name} started successfully`);
                await this.projectManager.refreshProjects();
                this.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to start managers (error code: ${result})`);
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
                // Set WinCC OA version for pmon component
                ExtensionOutputChannel.debug('SystemTreeProvider', `Setting WinCC OA version: ${project.version}`);
                this.pmon.setVersion(project.version);
                
                vscode.window.showInformationMessage(`⏹ Stopping ${project.name}...`);
                
                // Step 1: Stop all managers first
                ExtensionOutputChannel.info('SystemTreeProvider', `Stopping all managers for project: ${project.id}`);
                const stopResult = await this.pmon.stopProject(project.id);
                
                if (stopResult !== 0) {
                    vscode.window.showErrorMessage(`Failed to stop managers (error code: ${stopResult})`);
                    return;
                }
                
                // Wait for managers to stop
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Step 2: Now stop PMON
                vscode.window.showInformationMessage(`⏹ Stopping PMON for ${project.name}...`);
                ExtensionOutputChannel.info('SystemTreeProvider', `Stopping PMON for project: ${project.id}`);
                const pmonResult = await this.pmon.stopProjectAndPmon(project.id, undefined);
                
                if (pmonResult === 0) {
                    vscode.window.showInformationMessage(`✓ ${project.name} stopped`);
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(`Failed to stop PMON (error code: ${pmonResult})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop project: ${error}`);
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
            // Set WinCC OA version for pmon component
            ExtensionOutputChannel.debug('SystemTreeProvider', `Setting WinCC OA version: ${currentProject.version}`);
            this.pmon.setVersion(currentProject.version);
            
            vscode.window.showInformationMessage(`⟳ Starting system for ${currentProject.name}...`);
            
            // Step 1: Check if PMON is running
            ExtensionOutputChannel.debug('SystemTreeProvider', `Checking PMON status for project: ${currentProject.id}`);
            const pmonStatus = await this.pmon.getStatus(currentProject.id);
            ExtensionOutputChannel.debug('SystemTreeProvider', `PMON status: ${pmonStatus}`);
            
            if (pmonStatus !== ProjEnvPmonStatus.Running) {
                // Step 2: PMON not running - start it first
                vscode.window.showInformationMessage(`⟳ Starting PMON for ${currentProject.name}...`);
                ExtensionOutputChannel.info('SystemTreeProvider', `Starting PMON for project: ${currentProject.id}`);
                const pmonResult = await this.pmon.startPmonOnly(currentProject.id);
                
                if (pmonResult !== 0) {
                    vscode.window.showErrorMessage(`Failed to start PMON (error code: ${pmonResult})`);
                    return;
                }
                
                // Wait for PMON to initialize
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Step 3: Start all managers
            ExtensionOutputChannel.info('SystemTreeProvider', `Starting all managers for project: ${currentProject.id}`);
            const result = await this.pmon.startProject(currentProject.id, true);
            
            if (result === 0) {
                vscode.window.showInformationMessage(`✓ System started for ${currentProject.name}`);
                // Refresh to update status
                await this.projectManager.refreshProjects();
                this.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to start managers (error code: ${result})`);
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
            `Stop system for ${currentProject.name}?`,
            'Yes',
            'No'
        );
        
        if (answer === 'Yes') {
            try {
                // Set WinCC OA version for pmon component
                ExtensionOutputChannel.debug('SystemTreeProvider', `Setting WinCC OA version: ${currentProject.version}`);
                this.pmon.setVersion(currentProject.version);
                
                vscode.window.showInformationMessage(`⏹ Stopping system for ${currentProject.name}...`);
                
                // Step 1: Stop all managers first
                ExtensionOutputChannel.info('SystemTreeProvider', `Stopping all managers for project: ${currentProject.id}`);
                const stopResult = await this.pmon.stopProject(currentProject.id);
                
                if (stopResult !== 0) {
                    vscode.window.showErrorMessage(`Failed to stop managers (error code: ${stopResult})`);
                    return;
                }
                
                // Wait for managers to stop
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Step 2: Stop PMON
                vscode.window.showInformationMessage(`⏹ Stopping PMON for ${currentProject.name}...`);
                ExtensionOutputChannel.info('SystemTreeProvider', `Stopping PMON for project: ${currentProject.id}`);
                const pmonResult = await this.pmon.stopProjectAndPmon(currentProject.id, undefined);
                
                if (pmonResult === 0) {
                    vscode.window.showInformationMessage(`✓ System stopped for ${currentProject.name}`);
                    // Refresh to update status
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(`Failed to stop PMON (error code: ${pmonResult})`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop system: ${error}`);
            }
        }
    }

    async setActiveProject(project: any): Promise<void> {
        if (!project || !project.id) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        try {
            await this.projectManager.setCurrentProject(project.id);
            vscode.window.showInformationMessage(`✓ ${project.name} set as active project`);
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to set active project: ${error}`);
        }
    }

    async addProjectToWorkspace(project: any): Promise<void> {
        if (!project || !project.projectDir) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders || [];
            const alreadyInWorkspace = workspaceFolders.some(folder => folder.uri.fsPath === project.projectDir);
            
            if (alreadyInWorkspace) {
                vscode.window.showInformationMessage(`Project already in workspace`);
                return;
            }

            const success = vscode.workspace.updateWorkspaceFolders(
                workspaceFolders.length,
                0,
                { uri: vscode.Uri.file(project.projectDir) }
            );

            if (success) {
                vscode.window.showInformationMessage(`✓ Project added to workspace`);
            } else {
                vscode.window.showErrorMessage('Failed to add project to workspace');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add project to workspace: ${error}`);
        }
    }

    async openProjectInExplorer(project: any): Promise<void> {
        if (!project || !project.projectDir) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        try {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(project.projectDir));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open project in explorer: ${error}`);
        }
    }

    async addSubprojectToWorkspace(subprojectPath: string): Promise<void> {
        if (!subprojectPath || !fs.existsSync(subprojectPath)) {
            vscode.window.showErrorMessage('Invalid subproject path');
            return;
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders || [];
            const alreadyInWorkspace = workspaceFolders.some(folder => folder.uri.fsPath === subprojectPath);
            
            if (alreadyInWorkspace) {
                vscode.window.showInformationMessage(`Subproject already in workspace`);
                return;
            }

            const success = vscode.workspace.updateWorkspaceFolders(
                workspaceFolders.length,
                0,
                { uri: vscode.Uri.file(subprojectPath) }
            );

            if (success) {
                vscode.window.showInformationMessage(`✓ Subproject added to workspace`);
            } else {
                vscode.window.showErrorMessage('Failed to add subproject to workspace');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add subproject to workspace: ${error}`);
        }
    }

    async openSubprojectInExplorer(subprojectPath: string): Promise<void> {
        if (!subprojectPath || !fs.existsSync(subprojectPath)) {
            vscode.window.showErrorMessage('Invalid subproject path');
            return;
        }

        try {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(subprojectPath));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open subproject in explorer: ${error}`);
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
                // Set WinCC OA version for pmon component
                this.pmon.setVersion(currentProject.version);
                
                vscode.window.showInformationMessage(`⟳ Restarting PMON for ${currentProject.name}...`);
                
                // Stop PMON first
                await this.pmon.stopProjectAndPmon(currentProject.id, undefined);
                
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

    /**
     * Parse subprojects from config file
     * Returns array of proj_path entries (excluding the project itself)
     */
    private parseSubProjects(project: ProjectInfo): string[] {
        try {
            const configPath = path.join(project.projectDir, 'config', 'config');
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
                        // Exclude the project itself (last entry is usually the main project)
                        if (!projPath.endsWith(project.id)) {
                            projPaths.push(projPath);
                        }
                    }
                }
            }

            return projPaths;
        } catch (error) {
            console.error('[SystemTreeProvider] Failed to parse subprojects:', error);
            return [];
        }
    }
}

class SystemItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'systemStatus' | 'projectInfo' | 'info' | 'projects' | 'project' | 'subprojects' | 'subproject',
        public readonly description?: string,
        public readonly tooltipText?: string,
        public readonly isRunning?: boolean,
        public readonly projectPath?: string,
        public readonly projectData?: any,
        public readonly subprojectPath?: string
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
        } else if (itemType === 'subprojects') {
            this.iconPath = new vscode.ThemeIcon('symbol-namespace');
            this.contextValue = 'subprojects';
            this.tooltip = tooltipText;
            this.description = description;
        } else if (itemType === 'subproject') {
            this.iconPath = new vscode.ThemeIcon('folder-opened');
            this.contextValue = 'subproject';
            this.tooltip = tooltipText;
            this.description = description;
            // Click does nothing - use context menu instead
        } else if (itemType === 'project') {
            if (isRunning) {
                this.iconPath = new vscode.ThemeIcon('server-process', new vscode.ThemeColor('testing.iconPassed'));
            } else {
                this.iconPath = new vscode.ThemeIcon('server', new vscode.ThemeColor('testing.iconFailed'));
            }
            this.contextValue = 'project';
            this.tooltip = tooltipText;
            this.description = description;
            // Click does nothing - use context menu instead
        } else if (itemType === 'info') {
            this.iconPath = new vscode.ThemeIcon('symbol-property');
            this.contextValue = 'infoItem';
            this.description = description;
        }
    }
}
