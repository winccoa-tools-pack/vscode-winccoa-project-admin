import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';
import { ProjectInfo } from './types';

/**
 * Manages status bar UI for project selection
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor(private projectManager: ProjectManager, initialUpdate: boolean = true) {
        // Create status bar item (right side, high priority)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.statusBarItem.command = 'winccoa.core.selectProject';
        this.statusBarItem.tooltip = 'Click to select WinCC OA project';
        
        // Listen for project changes
        this.projectManager.onDidChangeProject(() => this.updateStatusBar());
        
        // Initial update only if requested
        if (initialUpdate) {
            this.updateStatusBar();
        } else {
            // Show loading state
            this.statusBarItem.text = '$(sync~spin) Loading WinCC OA...';
            this.statusBarItem.backgroundColor = undefined;
        }
        this.statusBarItem.show();
    }

    /**
     * Force update of status bar (called after initialization)
     */
    public forceUpdate(): void {
        this.updateStatusBar();
    }

    /**
     * Update status bar text based on current project
     */
    private updateStatusBar(): void {
        const currentProject = this.projectManager.getCurrentProject();

        if (currentProject) {
            const icon = currentProject.isRunning ? '$(server-process)' : '$(server-environment)';
            this.statusBarItem.text = `${icon} ${currentProject.name} (${currentProject.version})`;
            this.statusBarItem.backgroundColor = currentProject.isRunning 
                ? undefined 
                : new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            // No project selected - show error state in red
            this.statusBarItem.text = '$(server-environment) No WinCC OA project selected';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    /**
     * Show Quick Pick to select a project
     */
    async showProjectPicker(): Promise<void> {
        // Refresh project list first
        await this.projectManager.refreshProjects();

        const allProjects = this.projectManager.getRunningProjects();
        // Filter to only show running projects in picker
        const projects = allProjects.filter(p => p.status === 'running');
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
