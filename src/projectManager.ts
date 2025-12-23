import * as vscode from 'vscode';
import { getRunnableProjects } from '@winccoa-tools-pack/core-utils';
import type { ProjEnvProject } from '@winccoa-tools-pack/core-utils';
import { ProjectInfo, toProjectInfo } from './types';

/**
 * Manages WinCC OA project state and notifications
 */
export class ProjectManager {
    private _currentProject: ProjectInfo | undefined;
    private _runningProjects: ProjectInfo[] = [];
    private _onDidChangeProject = new vscode.EventEmitter<ProjectInfo | undefined>();
    private _refreshInterval: NodeJS.Timeout | undefined;

    public readonly onDidChangeProject = this._onDidChangeProject.event;

    constructor(private context: vscode.ExtensionContext) {
        // Don't load old state - always start fresh
    }

    /**
     * Initialize - load running projects and start auto-refresh
     */
    async initialize(): Promise<void> {
        // Wait for initial refresh to complete before continuing
        await this.refreshProjects();
        
        // Auto-refresh every 15 seconds to detect project start/stop
        this._refreshInterval = setInterval(() => {
            this.refreshProjects().catch(err => {
                console.error('[ProjectManager] Refresh failed:', err);
            });
        }, 15000);
        
        console.log('[ProjectManager] Auto-refresh enabled (every 15 seconds)');
    }

    /**
     * Get current project
     */
    getCurrentProject(): ProjectInfo | undefined {
        return this._currentProject;
    }

    /**
     * Get all running projects
     */
    getRunningProjects(): ProjectInfo[] {
        return this._runningProjects;
    }

    /**
     * Get all runnable projects (registered, both running and stopped)
     */
    async getAllRunnableProjects(): Promise<ProjectInfo[]> {
        try {
            const runnable: ProjEnvProject[] = await getRunnableProjects();
            const projects: ProjectInfo[] = [];
            
            for (const project of runnable) {
                const isRunning = await project.isPmonRunning();
                projects.push(toProjectInfo(project, isRunning));
            }
            
            return projects;
        } catch (error) {
            console.error('[ProjectManager] Failed to get runnable projects:', error);
            return [];
        }
    }

    /**
     * Set current project by ID
     */
    async setCurrentProject(projectId: string): Promise<boolean> {
        const project = this._runningProjects.find(p => p.id === projectId);
        if (!project) {
            vscode.window.showErrorMessage(`Project "${projectId}" not found or not running`);
            return false;
        }

        this._currentProject = project;
        this.saveState();
        this._onDidChangeProject.fire(project);
        
        vscode.window.showInformationMessage(`Switched to project: ${project.name}`);
        return true;
    }

    /**
     * Refresh list of running projects from shared library
     */
    async refreshProjects(): Promise<void> {
        try {
            // WORKAROUND: getRunningProjects() is broken (uses sync isRunning() stub)
            // Use getRunnableProjects() + isPmonRunning() instead
            const runnable: ProjEnvProject[] = await getRunnableProjects();
            const running: ProjEnvProject[] = [];
            
            for (const project of runnable) {
                if (await project.isPmonRunning()) {
                    running.push(project);
                }
            }
            
            // All projects in 'running' are actually running (we just checked)
            this._runningProjects = running.map(p => toProjectInfo(p, true));

            // If current project is not running anymore, clear it
            if (this._currentProject) {
                const stillRunning = this._runningProjects.find(
                    p => p.id === this._currentProject!.id
                );
                if (!stillRunning) {
                    this._currentProject = undefined;
                    this.saveState();
                    this._onDidChangeProject.fire(undefined);
                }
            }

            // Auto-select if only one project running and none selected
            if (!this._currentProject && this._runningProjects.length === 1) {
                this._currentProject = this._runningProjects[0];
                this.saveState();
                this._onDidChangeProject.fire(this._currentProject);
            }
        } catch (error) {
            console.error('[ProjectManager] Failed to refresh projects:', error);
            vscode.window.showErrorMessage('Failed to load WinCC OA projects');
        }
    }

    /**
     * Load state from workspace storage
     */
    private loadState(): void {
        const savedProject = this.context.workspaceState.get<ProjectInfo>('currentProject');
        if (savedProject) {
            this._currentProject = savedProject;
        }
    }

    /**
     * Save state to workspace storage
     */
    private saveState(): void {
        this.context.workspaceState.update('currentProject', this._currentProject);
    }

    dispose(): void {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
        }
        this._onDidChangeProject.dispose();
    }
}
