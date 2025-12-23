import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';
import { StatusBarManager } from './statusBarManager';
import { SystemTreeProvider } from './views/systemTreeProvider';
import { ManagerTreeProvider } from './views/managerTreeProvider';
import { WinCCOACoreAPI } from './types';

let projectManager: ProjectManager;
let statusBarManager: StatusBarManager;
let systemTreeProvider: SystemTreeProvider;
let managerTreeProvider: ManagerTreeProvider;

export async function activate(context: vscode.ExtensionContext): Promise<WinCCOACoreAPI> {
    console.log('[WinCC OA Core] ========== EXTENSION STARTING ==========');
    
    try {
        console.log('[WinCC OA Core] Activating extension...');

        // Initialize project manager
        console.log('[WinCC OA Core] Creating ProjectManager...');
        projectManager = new ProjectManager(context);
        console.log('[WinCC OA Core] Initializing ProjectManager...');
        await projectManager.initialize();
        console.log('[WinCC OA Core] ProjectManager initialized');

        // Initialize status bar
        console.log('[WinCC OA Core] Creating StatusBarManager...');
        statusBarManager = new StatusBarManager(projectManager);
        console.log('[WinCC OA Core] StatusBarManager created');

        // Initialize tree view providers
        console.log('[WinCC OA Core] Creating TreeView providers...');
        systemTreeProvider = new SystemTreeProvider(projectManager);
        managerTreeProvider = new ManagerTreeProvider(projectManager);
        
        // Register tree views
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('winccoa.systemView', systemTreeProvider)
        );
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('winccoa.managerView', managerTreeProvider)
        );
        console.log('[WinCC OA Core] TreeView providers registered');

        // Register command for project selection
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.core.selectProject', async () => {
                await statusBarManager.showProjectPicker();
            })
        );
        console.log('[WinCC OA Core] Registered selectProject command');

        // Register command for manual project refresh
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.core.refreshProjects', async () => {
                await projectManager.refreshProjects();
                vscode.window.showInformationMessage('WinCC OA projects refreshed');
            })
        );
        console.log('[WinCC OA Core] Registered refreshProjects command');

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
                console.log('[WinCC OA Core] Project Info:\n' + info);
            })
        );
        console.log('[WinCC OA Core] Registered showProjectInfo command');

        // Register view refresh commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.systemView.refresh', () => {
                systemTreeProvider.refresh();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.managerView.refresh', () => {
                managerTreeProvider.refresh();
            })
        );
        console.log('[WinCC OA Core] Registered view refresh commands');

        // Register manager control commands
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.start', async (item: any) => {
                if (item && item.managerIdx !== undefined) {
                    await managerTreeProvider.startManager(item.managerIdx);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.stop', async (item: any) => {
                if (item && item.managerIdx !== undefined) {
                    await managerTreeProvider.stopManager(item.managerIdx);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('winccoa.manager.restart', async (item: any) => {
                if (item && item.managerIdx !== undefined) {
                    await managerTreeProvider.restartManager(item.managerIdx);
                }
            })
        );
        console.log('[WinCC OA Core] Registered manager control commands');

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
        console.log('[WinCC OA Core] Registered system control commands');

        // Cleanup on dispose
        context.subscriptions.push(projectManager, statusBarManager);

        console.log('[WinCC OA Core] Extension activated successfully');
        vscode.window.showInformationMessage('WinCC OA Core activated!');

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
        console.error('[WinCC OA Core] ACTIVATION FAILED:', error);
        vscode.window.showErrorMessage(`WinCC OA Core failed to activate: ${error}`);
        throw error;
    }
}

export function deactivate() {
    console.log('[WinCC OA Core] Extension deactivated');
}

