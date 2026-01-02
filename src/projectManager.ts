import * as vscode from 'vscode';
import { getRunnableProjects } from '@winccoa-tools-pack/npm-winccoa-core';
import type { ProjEnvProject } from '@winccoa-tools-pack/npm-winccoa-core';
import { ProjectInfo, toProjectInfo } from './types';
import { ExtensionOutputChannel } from './extensionOutput';

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
                ExtensionOutputChannel.error('ProjectManager', 'Refresh failed', err instanceof Error ? err : new Error(String(err)));
            });
        }, 15000);
        
        ExtensionOutputChannel.info('ProjectManager', 'Auto-refresh enabled (every 15 seconds)');
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
            ExtensionOutputChannel.error('ProjectManager', 'Failed to get runnable projects', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }

    /**
     * Set current project by ID (accepts both running and stopped projects)
     */
    async setCurrentProject(projectId: string): Promise<boolean> {
        // First try to find in running projects
        let project = this._runningProjects.find(p => p.id === projectId);
        
        // If not running, try to find in all runnable projects
        if (!project) {
            const allProjects = await this.getAllRunnableProjects();
            project = allProjects.find(p => p.id === projectId);
        }
        
        if (!project) {
            vscode.window.showErrorMessage(`Project "${projectId}" not found`);
            return false;
        }

        this._currentProject = project;
        this.saveState();
        this._onDidChangeProject.fire(project);
        
        const status = project.isRunning ? 'running' : 'stopped';
        vscode.window.showInformationMessage(`✓ Set active project: ${project.name} (${status})`);
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

            // Update current project's running status (but keep it selected even if stopped)
            if (this._currentProject) {
                const stillRunning = this._runningProjects.find(
                    p => p.id === this._currentProject!.id
                );
                const wasRunning = this._currentProject.isRunning;
                
                if (stillRunning) {
                    // Update to running version - only fire if status changed
                    this._currentProject = stillRunning;
                    this.saveState();
                    if (!wasRunning) {
                        this._onDidChangeProject.fire(this._currentProject);
                        ExtensionOutputChannel.debug('ProjectManager', `Project ${this._currentProject.name} status changed: stopped → running`);
                    }
                } else {
                    // Project stopped - only fire if status changed
                    this._currentProject.isRunning = false;
                    this.saveState();
                    if (wasRunning) {
                        this._onDidChangeProject.fire(this._currentProject);
                        ExtensionOutputChannel.debug('ProjectManager', `Project ${this._currentProject.name} status changed: running → stopped`);
                    }
                }
            }

            // Auto-select first project if none selected and at least one running
            if (!this._currentProject && this._runningProjects.length > 0) {
                this._currentProject = this._runningProjects[0];
                this.saveState();
                this._onDidChangeProject.fire(this._currentProject);
                ExtensionOutputChannel.info(
                    'ProjectManager',
                    `Auto-selected first available project: ${this._currentProject.name}`
                );
            }
        } catch (error) {
            ExtensionOutputChannel.error('ProjectManager', 'Failed to refresh projects', error instanceof Error ? error : new Error(String(error)));
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
