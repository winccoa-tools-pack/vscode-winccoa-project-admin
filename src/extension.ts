import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';
import { StatusBarManager } from './statusBarManager';
import { WinCCOACoreAPI } from './types';

let projectManager: ProjectManager;
let statusBarManager: StatusBarManager;

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

