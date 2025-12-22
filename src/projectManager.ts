import * as vscode from 'vscode';
import { getRunningProjects } from '@winccoa-tools-pack/core-utils';
import type { ProjEnvProject } from '@winccoa-tools-pack/core-utils';
import { ProjectInfo, toProjectInfo } from './types';

/**
 * Manages WinCC OA project state and notifications
 */
export class ProjectManager {
    private _currentProject: ProjectInfo | undefined;
    private _runningProjects: ProjectInfo[] = [];
    private _onDidChangeProject = new vscode.EventEmitter<ProjectInfo | undefined>();

    public readonly onDidChangeProject = this._onDidChangeProject.event;

    constructor(private context: vscode.ExtensionContext) {
        this.loadState();
    }

    /**
     * Initialize - load running projects
     */
    async initialize(): Promise<void> {
        await this.refreshProjects();
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
            const projects: ProjEnvProject[] = await getRunningProjects();
            this._runningProjects = projects.map(toProjectInfo);

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
        this._onDidChangeProject.dispose();
    }
}
