import * as vscode from 'vscode';
import * as fs from 'fs';
import { ProjectManager } from './projectManager';
import { StatusBarManager } from './statusBarManager';
import { SystemTreeProvider } from './views/systemTreeProvider';
import { ManagerTreeProvider } from './views/managerTreeProvider';
import type { ProjectInfo, WinCCOACoreAPI } from './types';
import type { ManagerDisplayData } from './views/managerTreeProvider';
import { ExtensionOutputChannel } from './extensionOutput';

let projectManager: ProjectManager;
let statusBarManager: StatusBarManager;
let systemTreeProvider: SystemTreeProvider;
let managerTreeProvider: ManagerTreeProvider;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function hasManagerData(value: unknown): value is { managerData: ManagerDisplayData } {
    if (!isRecord(value)) return false;
    const managerData = value.managerData;
    return isRecord(managerData) && typeof managerData.idx === 'number';
}

function hasProjectData(value: unknown): value is { projectData: ProjectInfo } {
    if (!isRecord(value)) return false;
    const projectData = value.projectData;
    return isRecord(projectData) && typeof projectData.id === 'string';
}

function hasSubprojectPath(value: unknown): value is { subprojectPath: string } {
    if (!isRecord(value)) return false;
    return typeof value.subprojectPath === 'string';
}

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
        
        // Start background initialization (don't block activation)
        projectManager.initialize().then(() => {
            ExtensionOutputChannel.info('Extension', 'Background initialization complete');
            // Update status bar after initialization
            statusBarManager.forceUpdate();
        }).catch(err => {
            const error = err instanceof Error ? err : new Error(String(err));
            ExtensionOutputChannel.error('Extension', 'Background initialization failed', error);
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
            vscode.commands.registerCommand('winccoa.manager.start', async (item: unknown) => {
                if (hasManagerData(item)) {
                    await managerTreeProvider.startManager(item.managerData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.stop', async (item: unknown) => {
                if (hasManagerData(item)) {
                    await managerTreeProvider.stopManager(item.managerData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.restart', async (item: unknown) => {
                if (hasManagerData(item)) {
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
            vscode.commands.registerCommand('winccoa.project.start', async (item: unknown) => {
                if (hasProjectData(item)) {
                    await systemTreeProvider.startProject(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.stop', async (item: unknown) => {
                if (hasProjectData(item)) {
                    await systemTreeProvider.stopProject(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.setActive', async (item: unknown) => {
                if (hasProjectData(item)) {
                    await systemTreeProvider.setActiveProject(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.addToWorkspace', async (item: unknown) => {
                if (hasProjectData(item)) {
                    await systemTreeProvider.addProjectToWorkspace(item.projectData);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.project.openInExplorer', async (item: unknown) => {
                if (hasProjectData(item)) {
                    await systemTreeProvider.openProjectInExplorer(item.projectData);
                }
            })
        );
        ExtensionOutputChannel.info('Extension', 'Registered project control commands');
        
        // Register subproject commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.subproject.addToWorkspace', async (item: unknown) => {
                if (hasSubprojectPath(item)) {
                    await systemTreeProvider.addSubprojectToWorkspace(item.subprojectPath);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.subproject.openInExplorer', async (item: unknown) => {
                if (hasSubprojectPath(item)) {
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

                if (project.configPath && fs.existsSync(project.configPath)) {
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

