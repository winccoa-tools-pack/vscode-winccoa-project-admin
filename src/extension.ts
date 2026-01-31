import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';
import { StatusBarManager } from './statusBarManager';
import { SystemTreeProvider } from './views/systemTreeProvider';
import { ManagerTreeProvider } from './views/managerTreeProvider';
import { LanguageModelToolsService } from './languageModelTools';
import { WinCCOACoreAPI } from './types';
import { ExtensionOutputChannel } from './extensionOutput';

let projectManager: ProjectManager;
let statusBarManager: StatusBarManager;
let systemTreeProvider: SystemTreeProvider;
let managerTreeProvider: ManagerTreeProvider;
let languageModelToolsService: LanguageModelToolsService;

export async function activate(context: vscode.ExtensionContext): Promise<WinCCOACoreAPI> {
    // Initialize logger first
    ExtensionOutputChannel.initialize();
    ExtensionOutputChannel.info('Extension', '========== EXTENSION STARTING ==========');
    
    try {
        ExtensionOutputChannel.info('Extension', 'Activating extension...');

        // Initialize project manager (async, non-blocking)
        ExtensionOutputChannel.info('Extension', 'Creating ProjectManager...');
        projectManager = new ProjectManager(context);
        
        // Initialize status bar (without initial update)
        ExtensionOutputChannel.info('Extension', 'Creating StatusBarManager...');
        statusBarManager = new StatusBarManager(projectManager, false);
        
        // Initialize tree view providers immediately (they handle loading state)
        ExtensionOutputChannel.info('Extension', 'Creating TreeView providers...');
        systemTreeProvider = new SystemTreeProvider(projectManager);
        managerTreeProvider = new ManagerTreeProvider(projectManager);
        
        // Register tree views immediately
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('winccoa.systemView', systemTreeProvider)
        );
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('winccoa.managerView', managerTreeProvider)
        );
        ExtensionOutputChannel.info('Extension', 'TreeView providers registered');
        
        // Register Language Model Tools for GitHub Copilot
        ExtensionOutputChannel.info('Extension', 'Registering Language Model Tools...');
        languageModelToolsService = new LanguageModelToolsService(
            projectManager,
            systemTreeProvider,
            managerTreeProvider
        );
        languageModelToolsService.register(context);
        ExtensionOutputChannel.info('Extension', 'Language Model Tools registered');
        
        // Start background initialization (don't block activation)
        projectManager.initialize().then(() => {
            ExtensionOutputChannel.info('Extension', 'Background initialization complete');
            // Update status bar after initialization
            statusBarManager.forceUpdate();
        }).catch(err => {
            ExtensionOutputChannel.error('Extension', 'Background initialization failed', err);
        });

        // Register command for project selection
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.core.selectProject', async () => {
                await statusBarManager.showProjectPicker();
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered selectProject command');

        // Register command for manual project refresh
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.core.refreshProjects', async () => {
                await projectManager.refreshProjects();
                vscode.window.showInformationMessage('WinCC OA projects refreshed');
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered refreshProjects command');

        // Register command to show current project info (for testing)
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.core.showProjectInfo', async () => {
                // Force refresh to get latest data
                await projectManager.refreshProjects();
                
                const project = projectManager.getCurrentProject();
                if (!project) {
                    vscode.window.showWarningMessage('No project selected');
                    return;
                }
                
                const info = [
                    `Project: ${project.name}`,
                    `ID: ${project.id}`,
                    `Version: ${project.version}`,
                    `Project Path: ${project.projectDir}`,
                    `Install Dir: ${project.installDir}`,
                    `OA Install Path: ${project.oaInstallPath || 'NOT FOUND'}`,
                    `Config Path: ${project.configPath || 'NOT FOUND'}`,
                    `Running: ${project.isRunning}`
                ].join('\n');
                
                vscode.window.showInformationMessage(info, { modal: true });
                ExtensionOutputChannel.info('Extension', `Project Info:\n${info}`);
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered showProjectInfo command');

        // Register view refresh commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.systemView.refresh', async () => {
                ExtensionOutputChannel.info('Extension', '[REFRESH BUTTON] Triggered force refresh for all projects');
                // Force full refresh of all projects
                await projectManager.forceRefreshAll();
                // TreeView will auto-update via onDidChangeProjects event
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.managerView.refresh', () => {
                managerTreeProvider.refresh();
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered view refresh commands');

        // Register manager control commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.start', async (item: any) => {
                if (item && item.managerData) {
                    await managerTreeProvider.startManager(item.managerData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.stop', async (item: any) => {
                if (item && item.managerData) {
                    await managerTreeProvider.stopManager(item.managerData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.restart', async (item: any) => {
                if (item && item.managerData) {
                    await managerTreeProvider.restartManager(item.managerData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.add', async () => {
                await managerTreeProvider.addManager();
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered manager control commands');

        // Register system control commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.system.start', async () => {
                await systemTreeProvider.startOASystem();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.system.stop', async () => {
                await systemTreeProvider.stopOASystem();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.system.restart', async () => {
                await systemTreeProvider.restartOASystem();
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered system control commands');

        // Register project control commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.start', async (item: any) => {
                if (item && item.projectData) {
                    await systemTreeProvider.startProject(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.stop', async (item: any) => {
                if (item && item.projectData) {
                    await systemTreeProvider.stopProject(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.setActive', async (item: any) => {
                if (item && item.projectData) {
                    await systemTreeProvider.setActiveProject(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.addToWorkspace', async (item: any) => {
                if (item && item.projectData) {
                    await systemTreeProvider.addProjectToWorkspace(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.openInExplorer', async (item: any) => {
                if (item && item.projectData) {
                    await systemTreeProvider.openProjectInExplorer(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.register', async () => {
                await systemTreeProvider.registerNewProject();
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered project control commands');
        // Register project unregister command
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.unregister', async (item: any) => {
                if (item && item.projectData) {
                    await systemTreeProvider.unregisterProject(item.projectData);
                }
            })
        );        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.addToFavorites', async (item: any) => {
                if (item && item.projectData) {
                    const isFav = projectManager.isFavorite(item.projectData.id);
                    if (!isFav) {
                        projectManager.toggleFavorite(item.projectData.id);
                        vscode.window.showInformationMessage(`⭐ Added ${item.projectData.name} to favorites`);
                    }
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.removeFromFavorites', async (item: any) => {
                if (item && item.projectData) {
                    const isFav = projectManager.isFavorite(item.projectData.id);
                    if (isFav) {
                        projectManager.toggleFavorite(item.projectData.id);
                        vscode.window.showInformationMessage(`Removed ${item.projectData.name} from favorites`);
                    }
                }
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered project unregister command');

        // Register project from explorer context menu
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.explorer.registerProject', async (uri: vscode.Uri) => {
                if (uri) {
                    await systemTreeProvider.registerProjectFromExplorer(uri);
                }
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered explorer register project command');        
        // Register subproject commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.subproject.addToWorkspace', async (item: any) => {
                if (item && item.subprojectPath) {
                    await systemTreeProvider.addSubprojectToWorkspace(item.subprojectPath);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.subproject.openInExplorer', async (item: any) => {
                if (item && item.subprojectPath) {
                    await systemTreeProvider.openSubprojectInExplorer(item.subprojectPath);
                }
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered subproject commands');

        // Register utility commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.openConfig', async () => {
                const project = projectManager.getCurrentProject();
                if (!project) {
                    vscode.window.showErrorMessage('No project selected');
                    return;
                }

                if (project.configPath && require('fs').existsSync(project.configPath)) {
                    const configUri = vscode.Uri.file(project.configPath);
                    const document = await vscode.workspace.openTextDocument(configUri);
                    await vscode.window.showTextDocument(document);
                    ExtensionOutputChannel.info('Extension', `Opened config file: ${project.configPath}`);
                } else {
                    vscode.window.showErrorMessage(`Config file not found: ${project.configPath}`);
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.openLogViewer', async () => {
                const logViewerExtension = vscode.extensions.getExtension('richardjanisch.winccoa-vscode-logviewer');
                
                if (logViewerExtension) {
                    ExtensionOutputChannel.info('Extension', 'Log Viewer extension found, opening...');
                    await vscode.commands.executeCommand('winccoa-logviewer.open');
                } else {
                    const selection = await vscode.window.showInformationMessage(
                        'WinCC OA Log Viewer extension is not installed.',
                        'Install Extension'
                    );
                    
                    if (selection === 'Install Extension') {
                        await vscode.env.openExternal(vscode.Uri.parse('vscode:extension/richardjanisch.winccoa-vscode-logviewer'));
                    }
                }
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered utility commands');

        // Cleanup on dispose
        context.subscriptions.push(projectManager, statusBarManager);

        ExtensionOutputChannel.success('Extension', 'Extension activated successfully');

        // Return public API for other extensions
        return {
            getCurrentProject: () => projectManager.getCurrentProject(),
            setCurrentProject: (projectId: string) => projectManager.setCurrentProject(projectId),
            getRunningProjects: () => Promise.resolve(projectManager.getRunningProjects()),
            onDidChangeProject: (listener) => {
                const disposable = projectManager.onDidChangeProject(listener);
                return disposable.dispose.bind(disposable);
            }
        };
    } catch (error) {
        ExtensionOutputChannel.error('Extension', 'ACTIVATION FAILED', error instanceof Error ? error : new Error(String(error)));
        vscode.window.showErrorMessage(`WinCC OA Core failed to activate: ${error}`);
        throw error;
    }
}

export function deactivate() {
    ExtensionOutputChannel.info('Extension', 'Extension deactivated');
}

