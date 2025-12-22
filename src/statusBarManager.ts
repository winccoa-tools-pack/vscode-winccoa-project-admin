import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';
import { ProjectInfo } from './types';

/**
 * Manages status bar UI for project selection
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor(private projectManager: ProjectManager) {
        // Create status bar item (right side, high priority)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.statusBarItem.command = 'winccoa.core.selectProject';
        this.statusBarItem.tooltip = 'Click to select WinCC OA project';
        
        // Listen for project changes
        this.projectManager.onDidChangeProject(() => this.updateStatusBar());
        
        // Initial update
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    /**
     * Update status bar text based on current project
     */
    private updateStatusBar(): void {
        const currentProject = this.projectManager.getCurrentProject();
        const runningCount = this.projectManager.getRunningProjects().length;

        if (currentProject) {
            this.statusBarItem.text = `$(server-process) ${currentProject.name} (${currentProject.version})`;
            this.statusBarItem.backgroundColor = undefined;
        } else if (runningCount > 0) {
            this.statusBarItem.text = `$(server) ${runningCount} WinCC OA project${runningCount > 1 ? 's' : ''}`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = '$(server-environment) No WinCC OA project';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    /**
     * Show Quick Pick to select a project
     */
    async showProjectPicker(): Promise<void> {
        // Refresh project list first
        await this.projectManager.refreshProjects();

        const projects = this.projectManager.getRunningProjects();
        const currentProject = this.projectManager.getCurrentProject();

        if (projects.length === 0) {
            vscode.window.showWarningMessage('No running WinCC OA projects found');
            return;
        }

        // Create Quick Pick items
        const items: vscode.QuickPickItem[] = projects.map(project => ({
            label: project.name,
            description: `v${project.version} - ${project.projectDir}`,
            detail: project.id === currentProject?.id ? '$(check) Current project' : undefined,
            picked: project.id === currentProject?.id
        }));

        // Show Quick Pick
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a WinCC OA project',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const projectId = projects.find(p => p.name === selected.label)?.id;
            if (projectId) {
                await this.projectManager.setCurrentProject(projectId);
            }
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
