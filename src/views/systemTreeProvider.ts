import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectManager } from '../projectManager';
import { PmonComponent } from '@winccoa-tools-pack/npm-winccoa-core';
import { ProjEnvPmonStatus } from '@winccoa-tools-pack/npm-winccoa-core';
import { ProjEnvProject } from '@winccoa-tools-pack/npm-winccoa-core';
import type { ProjectInfo } from '../types';
import { ExtensionOutputChannel } from '../extensionOutput';

export class SystemItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType:
            | 'systemStatus'
            | 'projectInfo'
            | 'info'
            | 'projects'
            | 'project'
            | 'subprojects'
            | 'subproject',
        public readonly description?: string,
        public readonly tooltipText?: string,
        public readonly isRunning?: boolean,
        public readonly projectPath?: string,
        public readonly projectData?: ProjectInfo | string[],
        public readonly subprojectPath?: string,
        public readonly customIconPath?: vscode.ThemeIcon,
    ) {
        super(label, collapsibleState);

        if (itemType === 'systemStatus') {
            if (isRunning) {
                this.iconPath = new vscode.ThemeIcon(
                    'pulse',
                    new vscode.ThemeColor('testing.iconPassed'),
                );
            } else {
                this.iconPath = new vscode.ThemeIcon(
                    'circle-slash',
                    new vscode.ThemeColor('testing.iconFailed'),
                );
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
            // Use custom icon if provided (e.g., error icon)
            if (customIconPath) {
                this.iconPath = customIconPath;
            } else if (isRunning) {
                this.iconPath = new vscode.ThemeIcon(
                    'server-process',
                    new vscode.ThemeColor('testing.iconPassed'),
                );
            } else {
                this.iconPath = new vscode.ThemeIcon(
                    'server',
                    new vscode.ThemeColor('testing.iconFailed'),
                );
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

export class SystemTreeProvider implements vscode.TreeDataProvider<SystemItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SystemItem | undefined | null | void> =
        new vscode.EventEmitter<SystemItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SystemItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private pmon: PmonComponent = new PmonComponent();

    constructor(private projectManager: ProjectManager) {
        // Subscribe to current project changes
        this.projectManager.onDidChangeProject(() => {
            this.refresh();
        });

        // Subscribe to project list changes (for progressive loading)
        this.projectManager.onDidChangeProjects(() => {
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
                                undefined,
                            ),
                        ];
                    }
                } catch {
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
                    isRunning,
                ),
                new SystemItem(
                    'Project Information',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'projectInfo',
                    undefined,
                    'WinCC OA Project Details',
                    undefined,
                ),
                new SystemItem(
                    'Projects',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'projects',
                    undefined,
                    'Main Project and Subprojects',
                    undefined,
                ),
            ];
        } else if (element.itemType === 'projectInfo') {
            const currentProject = this.projectManager.getCurrentProject();

            if (currentProject) {
                const items = [
                    new SystemItem(
                        'Project Name',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        currentProject.name,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                    ),
                    new SystemItem(
                        'Version',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        currentProject.version || 'N/A',
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                    ),
                    new SystemItem(
                        'Project Path',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        currentProject.projectDir,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                    ),
                    new SystemItem(
                        'Install Path',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        currentProject.oaInstallPath,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                    ),
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
                            undefined,
                        ),
                    );
                }

                return items;
            } else {
                return [
                    new SystemItem(
                        'No project selected',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        'Select a project from status bar',
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                    ),
                ];
            }
        } else if (element.itemType === 'subprojects') {
            // Display subprojects stored in projectData
            const subProjects = Array.isArray(element.projectData) ? element.projectData : [];
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
                    subProj,
                );
            });
        } else if (element.itemType === 'projects') {
            // Use cached running projects instead of polling again
            const allProjects = this.projectManager.getRunningProjects();

            if (allProjects.length === 0) {
                return [
                    new SystemItem(
                        'No projects found',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        'Register a project first',
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                    ),
                ];
            }

            // Sort projects: favorites first (by name), then non-favorites (by name)
            const sorted = allProjects.sort((a, b) => {
                const aFav = this.projectManager.isFavorite(a.id);
                const bFav = this.projectManager.isFavorite(b.id);

                // Favorites always come first
                if (aFav && !bFav) return -1;
                if (!aFav && bFav) return 1;

                // Within same group, sort alphabetically
                return a.name.localeCompare(b.name);
            });

            return sorted.map((project) => {
                const isFavorite = this.projectManager.isFavorite(project.id);
                // Determine icon and description based on project status
                let description: string;
                let tooltip: string;
                let iconPath: vscode.ThemeIcon | undefined;

                // Favorite prefix for description
                const favPrefix = isFavorite ? '⭐ ' : '';

                switch (project.status) {
                    case 'unknown':
                        description = `${favPrefix}Loading...`;
                        tooltip = `Project: ${project.name}\nStatus: Loading...${
                            isFavorite ? '\n⭐ Favorite' : ''
                        }`;
                        iconPath = new vscode.ThemeIcon(
                            'circle-outline',
                            new vscode.ThemeColor('descriptionForeground'),
                        );
                        break;
                    case 'running':
                        description = `${favPrefix}Running`;
                        tooltip = `Project: ${project.name}\nStatus: Running${
                            isFavorite ? '\n⭐ Favorite' : ''
                        }`;
                        iconPath = new vscode.ThemeIcon(
                            'circle-filled',
                            new vscode.ThemeColor('testing.iconPassed'),
                        );
                        break;
                    case 'stopped':
                        description = `${favPrefix}Stopped`;
                        tooltip = `Project: ${project.name}\nStatus: Stopped${
                            isFavorite ? '\n⭐ Favorite' : ''
                        }`;
                        iconPath = new vscode.ThemeIcon(
                            'circle-filled',
                            new vscode.ThemeColor('testing.iconFailed'),
                        );
                        break;
                    case 'transitioning':
                        description = `${favPrefix}Transitioning...`;
                        tooltip = `Project: ${project.name}\nStatus: Transitioning${
                            isFavorite ? '\n⭐ Favorite' : ''
                        }`;
                        iconPath = new vscode.ThemeIcon(
                            'sync~spin',
                            new vscode.ThemeColor('charts.yellow'),
                        );
                        break;
                    case 'error':
                        description = `${favPrefix}Error`;
                        tooltip = `Project: ${project.name}\nError: ${project.error}${
                            isFavorite ? '\n⭐ Favorite' : ''
                        }`;
                        iconPath = new vscode.ThemeIcon(
                            'warning',
                            new vscode.ThemeColor('errorForeground'),
                        );
                        break;
                    default:
                        description = favPrefix + (project.isRunning ? 'Running' : 'Stopped');
                        tooltip = `Project: ${project.name}${isFavorite ? '\n⭐ Favorite' : ''}`;
                        iconPath = project.isRunning
                            ? new vscode.ThemeIcon(
                                  'circle-filled',
                                  new vscode.ThemeColor('testing.iconPassed'),
                              )
                            : new vscode.ThemeIcon(
                                  'circle-filled',
                                  new vscode.ThemeColor('testing.iconFailed'),
                              );
                }

                const item = new SystemItem(
                    project.name,
                    vscode.TreeItemCollapsibleState.None,
                    'project',
                    description,
                    tooltip,
                    project.isRunning,
                    project.projectDir,
                    project,
                    undefined, // subprojectPath not needed for projects
                    iconPath,
                );

                // Override contextValue to distinguish favorites
                item.contextValue = isFavorite ? 'project-favorite' : 'project-nonfavorite';

                return item;
            });
        }
        return [];
    }

    async startProject(project: ProjectInfo): Promise<void> {
        if (!project || !project.id) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        try {
            vscode.window.showInformationMessage(`⟳ Starting ${project.name}...`);

            // Step 1: Check if PMON is running
            ExtensionOutputChannel.debug(
                'SystemTreeProvider',
                `Checking PMON status for project: ${project.id}`,
            );
            const pmonStatus = await this.pmon.getStatus(project.id);
            ExtensionOutputChannel.debug('SystemTreeProvider', `PMON status: ${pmonStatus}`);

            if (pmonStatus !== ProjEnvPmonStatus.Running) {
                // Step 2: PMON not running - start it first
                vscode.window.showInformationMessage(`⟳ Starting PMON for ${project.name}...`);
                ExtensionOutputChannel.info(
                    'SystemTreeProvider',
                    `Starting PMON for project: ${project.id}`,
                );
                const pmonResult = await this.pmon.startPmonOnly(project.id);

                if (pmonResult !== 0) {
                    vscode.window.showErrorMessage(
                        `Failed to start PMON (error code: ${pmonResult})`,
                    );
                    return;
                }

                // Wait a moment for PMON to initialize
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            // Step 3: Now start all managers
            ExtensionOutputChannel.info(
                'SystemTreeProvider',
                `Starting all managers for project: ${project.id}`,
            );
            const result = await this.pmon.startProject(project.id, true);

            if (result === 0) {
                vscode.window.showInformationMessage(`✓ ${project.name} started successfully`);
                await this.projectManager.refreshProjects();
                this.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to start managers (error code: ${result})`);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to start project: ${errorMsg}`);
        }
    }

    async stopProject(project: ProjectInfo): Promise<void> {
        if (!project || !project.id) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to stop ${project.name}?`,
            'Yes',
            'No',
        );

        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage(`⏹ Stopping ${project.name}...`);

                // Step 1: Stop all managers first
                ExtensionOutputChannel.info(
                    'SystemTreeProvider',
                    `Stopping all managers for project: ${project.id}`,
                );
                const stopResult = await this.pmon.stopProject(project.id);

                if (stopResult !== 0) {
                    vscode.window.showErrorMessage(
                        `Failed to stop managers (error code: ${stopResult})`,
                    );
                    return;
                }

                // Wait for managers to stop
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Step 2: Now stop PMON
                vscode.window.showInformationMessage(`⏹ Stopping PMON for ${project.name}...`);
                ExtensionOutputChannel.info(
                    'SystemTreeProvider',
                    `Stopping PMON for project: ${project.id}`,
                );
                const pmonResult = await this.pmon.stopProjectAndPmon(project.id, undefined);

                if (pmonResult === 0) {
                    vscode.window.showInformationMessage(`✓ ${project.name} stopped`);
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(
                        `Failed to stop PMON (error code: ${pmonResult})`,
                    );
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to stop project: ${errorMsg}`);
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
            vscode.window.showInformationMessage(`⟳ Starting system for ${currentProject.name}...`);

            // Step 1: Check if PMON is running
            ExtensionOutputChannel.debug(
                'SystemTreeProvider',
                `Checking PMON status for project: ${currentProject.id}`,
            );
            const pmonStatus = await this.pmon.getStatus(currentProject.id);
            ExtensionOutputChannel.debug('SystemTreeProvider', `PMON status: ${pmonStatus}`);

            if (pmonStatus !== ProjEnvPmonStatus.Running) {
                // Step 2: PMON not running - start it first
                vscode.window.showInformationMessage(
                    `⟳ Starting PMON for ${currentProject.name}...`,
                );
                ExtensionOutputChannel.info(
                    'SystemTreeProvider',
                    `Starting PMON for project: ${currentProject.id}`,
                );
                const pmonResult = await this.pmon.startPmonOnly(currentProject.id);

                if (pmonResult !== 0) {
                    vscode.window.showErrorMessage(
                        `Failed to start PMON (error code: ${pmonResult})`,
                    );
                    return;
                }

                // Wait for PMON to initialize
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            // Step 3: Start all managers
            ExtensionOutputChannel.info(
                'SystemTreeProvider',
                `Starting all managers for project: ${currentProject.id}`,
            );
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
            'No',
        );

        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage(
                    `⏹ Stopping system for ${currentProject.name}...`,
                );

                // Step 1: Stop all managers first
                ExtensionOutputChannel.info(
                    'SystemTreeProvider',
                    `Stopping all managers for project: ${currentProject.id}`,
                );
                const stopResult = await this.pmon.stopProject(currentProject.id);

                if (stopResult !== 0) {
                    vscode.window.showErrorMessage(
                        `Failed to stop managers (error code: ${stopResult})`,
                    );
                    return;
                }

                // Wait for managers to stop
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Step 2: Stop PMON
                vscode.window.showInformationMessage(
                    `⏹ Stopping PMON for ${currentProject.name}...`,
                );
                ExtensionOutputChannel.info(
                    'SystemTreeProvider',
                    `Stopping PMON for project: ${currentProject.id}`,
                );
                const pmonResult = await this.pmon.stopProjectAndPmon(currentProject.id, undefined);

                if (pmonResult === 0) {
                    vscode.window.showInformationMessage(
                        `✓ System stopped for ${currentProject.name}`,
                    );
                    // Refresh to update status
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(
                        `Failed to stop PMON (error code: ${pmonResult})`,
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop system: ${error}`);
            }
        }
    }

    async setActiveProject(project: ProjectInfo): Promise<void> {
        if (!project || !project.id) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        try {
            await this.projectManager.setCurrentProject(project.id);
            vscode.window.showInformationMessage(`✓ ${project.name} set as active project`);
            this.refresh();
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to set active project: ${errorMsg}`);
        }
    }

    async addProjectToWorkspace(project: ProjectInfo): Promise<void> {
        if (!project || !project.projectDir) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders || [];
            const alreadyInWorkspace = workspaceFolders.some(
                (folder) => folder.uri.fsPath === project.projectDir,
            );

            if (alreadyInWorkspace) {
                vscode.window.showInformationMessage(`Project already in workspace`);
                return;
            }

            const success = vscode.workspace.updateWorkspaceFolders(workspaceFolders.length, 0, {
                uri: vscode.Uri.file(project.projectDir),
            });

            if (success) {
                vscode.window.showInformationMessage(`✓ Project added to workspace`);
            } else {
                vscode.window.showErrorMessage('Failed to add project to workspace');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to add project to workspace: ${errorMsg}`);
        }
    }

    async openProjectInExplorer(project: ProjectInfo): Promise<void> {
        if (!project || !project.projectDir) {
            vscode.window.showErrorMessage('Invalid project');
            return;
        }

        try {
            await vscode.commands.executeCommand(
                'revealFileInOS',
                vscode.Uri.file(project.projectDir),
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to open project in explorer: ${errorMsg}`);
        }
    }

    async addSubprojectToWorkspace(subprojectPath: string): Promise<void> {
        if (!subprojectPath || !fs.existsSync(subprojectPath)) {
            vscode.window.showErrorMessage('Invalid subproject path');
            return;
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders || [];
            const alreadyInWorkspace = workspaceFolders.some(
                (folder) => folder.uri.fsPath === subprojectPath,
            );

            if (alreadyInWorkspace) {
                vscode.window.showInformationMessage(`Subproject already in workspace`);
                return;
            }

            const success = vscode.workspace.updateWorkspaceFolders(workspaceFolders.length, 0, {
                uri: vscode.Uri.file(subprojectPath),
            });

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
            'No',
        );

        if (answer === 'Yes') {
            try {
                vscode.window.showInformationMessage(
                    `⟳ Restarting PMON for ${currentProject.name}...`,
                );

                // Stop PMON first
                await this.pmon.stopProjectAndPmon(currentProject.id, undefined);

                // Wait a moment
                await new Promise((resolve) => setTimeout(resolve, 1000));

                // Start PMON again
                const result = await this.pmon.startPmonOnly(currentProject.id);

                if (result === 0) {
                    vscode.window.showInformationMessage(
                        `✓ PMON restarted for ${currentProject.name}`,
                    );
                    // Refresh to update status
                    await this.projectManager.refreshProjects();
                    this.refresh();
                } else {
                    vscode.window.showErrorMessage(
                        `Failed to restart PMON (error code: ${result})`,
                    );
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

    /**
     * Register a WinCC OA project from Explorer context menu
     */
    async registerProjectFromExplorer(uri: vscode.Uri): Promise<void> {
        const projectPath = uri.fsPath;
        await this.registerProject(projectPath);
    }

    /**
     * Register a new WinCC OA project
     */
    async registerNewProject(): Promise<void> {
        try {
            ExtensionOutputChannel.info(
                'SystemTreeProvider',
                'Starting project registration wizard',
            );

            // Step 1: Ask user to select project folder
            const projectFolder = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Project Folder',
                title: 'Select WinCC OA Project to Register',
            });

            if (!projectFolder || projectFolder.length === 0) {
                ExtensionOutputChannel.info(
                    'SystemTreeProvider',
                    'Project registration cancelled by user',
                );
                return;
            }

            const projectPath = projectFolder[0].fsPath;
            await this.registerProject(projectPath);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error during registration: ${errorMsg}`);
            ExtensionOutputChannel.error('SystemTreeProvider', `Registration error: ${errorMsg}`);
        }
    }

    /**
     * Common registration logic for both UI and Explorer
     */
    private async registerProject(projectPath: string): Promise<void> {
        try {
            const projectId = path.basename(projectPath);

            ExtensionOutputChannel.info('SystemTreeProvider', `Selected project: ${projectPath}`);

            // Step 2: Validate project structure
            const configPath = path.join(projectPath, 'config', 'config');
            if (!fs.existsSync(configPath)) {
                vscode.window.showErrorMessage(
                    `Invalid project: config file not found at ${configPath}`,
                );
                ExtensionOutputChannel.error(
                    'SystemTreeProvider',
                    `Config file not found: ${configPath}`,
                );
                return;
            }

            ExtensionOutputChannel.info(
                'SystemTreeProvider',
                `Valid project detected: ${projectId}`,
            );

            // Step 3: Detect version from config file
            let projectVersion = '3.19'; // Default fallback
            try {
                const configContent = fs.readFileSync(configPath, 'utf-8');
                const versionMatch = configContent.match(/pvss_path\s*=\s*"([^"]+)"/);
                if (versionMatch) {
                    const pvssPath = versionMatch[1];
                    const pathVersionMatch = pvssPath.match(/(\d+\.\d+)/);
                    if (pathVersionMatch) {
                        projectVersion = pathVersionMatch[1];
                        ExtensionOutputChannel.info(
                            'SystemTreeProvider',
                            `Detected version from config: ${projectVersion}`,
                        );
                    }
                }
            } catch {
                ExtensionOutputChannel.warn(
                    'SystemTreeProvider',
                    `Could not read version from config, using default: ${projectVersion}`,
                );
            }

            // Step 4: Confirm with user
            const confirmation = await vscode.window.showInformationMessage(
                `Register project "${projectId}" (Version ${projectVersion})?`,
                { modal: true },
                'Yes',
                'No',
            );

            if (confirmation !== 'Yes') {
                ExtensionOutputChannel.info('SystemTreeProvider', 'Registration cancelled by user');
                return;
            }

            // Step 5: Register project
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Registering project ${projectId}...`,
                    cancellable: false,
                },
                async (progress) => {
                    try {
                        progress.report({ message: 'Creating project instance...' });

                        const project = new ProjEnvProject();
                        project.setDir(projectPath);
                        project.setVersion(projectVersion);
                        project.setRunnable(true);

                        ExtensionOutputChannel.info(
                            'SystemTreeProvider',
                            `Project setup: ID=${project.getId()}, Version=${project.getVersion()}`,
                        );

                        // Check if already registered
                        if (project.isRegistered()) {
                            const overwrite = await vscode.window.showWarningMessage(
                                `Project "${projectId}" is already registered. Unregister and re-register?`,
                                { modal: true },
                                'Yes',
                                'No',
                            );

                            if (overwrite !== 'Yes') {
                                ExtensionOutputChannel.info(
                                    'SystemTreeProvider',
                                    'Registration cancelled - already registered',
                                );
                                return;
                            }

                            progress.report({ message: 'Unregistering existing project...' });
                            const unregResult = await project.unregisterProj();

                            if (unregResult !== 0) {
                                throw new Error(
                                    `Failed to unregister project (code: ${unregResult})`,
                                );
                            }

                            ExtensionOutputChannel.info(
                                'SystemTreeProvider',
                                'Project unregistered successfully',
                            );
                        }

                        progress.report({ message: 'Registering with WinCC OA...' });
                        ExtensionOutputChannel.info(
                            'SystemTreeProvider',
                            'Calling registerProj()...',
                        );

                        const result = await project.registerProj();

                        if (result === 0) {
                            vscode.window.showInformationMessage(
                                `✓ Project "${projectId}" registered successfully!`,
                            );
                            ExtensionOutputChannel.info(
                                'SystemTreeProvider',
                                `Project registered: ${projectId}`,
                            );

                            // Refresh project list
                            await this.projectManager.refreshProjects();
                            this.refresh();
                        } else if (result === -1) {
                            throw new Error('Config file not found or invalid');
                        } else {
                            throw new Error(`Registration failed with code: ${result}`);
                        }
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Failed to register project: ${errorMsg}`);
                        ExtensionOutputChannel.error(
                            'SystemTreeProvider',
                            `Registration failed: ${errorMsg}`,
                        );
                    }
                },
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error during registration: ${errorMsg}`);
            ExtensionOutputChannel.error('SystemTreeProvider', `Registration error: ${errorMsg}`);
        }
    }

    /**
     */
    async unregisterProject(projectData: ProjectInfo): Promise<void> {
        const projectId = projectData.id;
        const projectPath = projectData.projectDir;

        ExtensionOutputChannel.info(
            'SystemTreeProvider',
            `Starting unregister flow for project: ${projectId}`,
        );

        // Confirmation dialog with explanation
        const confirm = await vscode.window.showWarningMessage(
            `⚠️ Unregister Project "${projectId}"?\n\nThis will remove the project from WinCC OA's registry (pvssInst.conf).\nThe project files will NOT be deleted.`,
            { modal: true },
            'Yes, Unregister',
            'Cancel',
        );

        if (confirm !== 'Yes, Unregister') {
            ExtensionOutputChannel.info('SystemTreeProvider', 'Unregister cancelled by user');
            return;
        }

        // Execute unregister
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Unregistering project ${projectId}...`,
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({ message: 'Creating project instance...' });

                    const project = new ProjEnvProject();
                    project.setId(projectId);

                    // Check if project is currently running
                    if (projectData.status === 'running') {
                        const stopFirst = await vscode.window.showWarningMessage(
                            `Project "${projectId}" is currently running. Stop it first?`,
                            { modal: true },
                            'Stop and Unregister',
                            'Cancel',
                        );

                        if (stopFirst !== 'Stop and Unregister') {
                            ExtensionOutputChannel.info(
                                'SystemTreeProvider',
                                'Unregister cancelled - project is running',
                            );
                            return;
                        }

                        progress.report({ message: 'Stopping project...' });
                        ExtensionOutputChannel.info(
                            'SystemTreeProvider',
                            'Stopping PMON before unregister...',
                        );

                        project.setDir(projectPath);
                        project.setVersion(projectData.version);
                        await project.stopPmon(10);

                        ExtensionOutputChannel.info(
                            'SystemTreeProvider',
                            'PMON stopped successfully',
                        );
                    }

                    // Unregister project
                    progress.report({ message: 'Unregistering from WinCC OA...' });
                    ExtensionOutputChannel.info(
                        'SystemTreeProvider',
                        'Calling unregisterProj()...',
                    );

                    const result = await project.unregisterProj();

                    if (result === 0) {
                        vscode.window.showInformationMessage(
                            `✓ Project "${projectId}" unregistered successfully!`,
                        );
                        ExtensionOutputChannel.info(
                            'SystemTreeProvider',
                            `Project ${projectId} unregistered successfully`,
                        );

                        // Refresh project list
                        progress.report({ message: 'Refreshing project list...' });
                        await this.projectManager.refreshProjects();
                        this.refresh();
                    } else {
                        throw new Error(`Unregister failed with code: ${result}`);
                    }
                },
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to unregister project: ${errorMsg}`);
            ExtensionOutputChannel.error('SystemTreeProvider', `Unregister error: ${errorMsg}`);
        }
    }
}
