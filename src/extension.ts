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

