import * as vscode from 'vscode';
import { getRunnableProjects } from '@winccoa-tools-pack/npm-winccoa-core';
import type { ProjEnvProject } from '@winccoa-tools-pack/npm-winccoa-core';
import { ProjectInfo, toProjectInfo, ProjectStatus } from './types';
import { ExtensionOutputChannel } from './extensionOutput';

/**
 * Manages WinCC OA project state and notifications
 */
export class ProjectManager {
    private _currentProject: ProjectInfo | undefined;
    private _runningProjects: ProjectInfo[] = [];
    private _failedProjects: Set<string> = new Set(); // Cache for projects with errors
    private _onDidChangeProject = new vscode.EventEmitter<ProjectInfo | undefined>();
    private _onDidChangeProjects = new vscode.EventEmitter<void>(); // NEW: For TreeView refresh
    private _refreshInterval: NodeJS.Timeout | undefined;
    private _isInitialLoad = true; // Track if this is the first load

    public readonly onDidChangeProject = this._onDidChangeProject.event;
    public readonly onDidChangeProjects = this._onDidChangeProjects.event; // NEW

    constructor(private context: vscode.ExtensionContext) {
        // Don't load old state - always start fresh
    }

    /**
     * Initialize - load projects progressively and start smart polling
     */
    async initialize(): Promise<void> {
        // Phase 1: Show all projects immediately with "Unknown" status
        await this.loadProjectsInitial();
        
        // Phase 2: Load status sequentially (progressive UX)
        await this.loadProjectStatusProgressive();
        
        // Phase 3: Smart polling - only running/transitioning projects
        this._refreshInterval = setInterval(() => {
            this.refreshSmartPolling().catch(err => {
                ExtensionOutputChannel.error('ProjectManager', 'Refresh failed', err instanceof Error ? err : new Error(String(err)));
            });
        }, 15000);
        
        ExtensionOutputChannel.info('ProjectManager', 'Progressive loading enabled with smart polling (every 15 seconds)');
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
                try {
                    const version = project.getVersion();
                    if (!version) {
                        ExtensionOutputChannel.warn('ProjectManager', `Project ${project.getId()} has no version - skipping PMON status check`);
                        projects.push(toProjectInfo(project, 'stopped'));
                        continue;
                    }
                    
                    const isRunning = await project.isPmonRunning();
                    projects.push(toProjectInfo(project, isRunning ? 'running' : 'stopped'));
                } catch (projectError) {
                    const error = projectError instanceof Error ? projectError : new Error(String(projectError));
                    ExtensionOutputChannel.warn('ProjectManager', `Failed to check PMON status for project ${project.getId()}: ${error.message}`);
                    // Include project anyway, but mark as error
                    projects.push(toProjectInfo(project, 'error', error.message));
                }
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
        
        const status = project.status === 'running' ? 'running' : 'stopped';
        vscode.window.showInformationMessage(`✓ Set active project: ${project.name} (${status})`);
        return true;
    }

    /**
     * Phase 1: Load all projects immediately with "Unknown" status
     */
    private async loadProjectsInitial(): Promise<void> {
        try {
            // Import getRegisteredProjects for debug logging
            const { getRegisteredProjects } = await import('@winccoa-tools-pack/npm-winccoa-core');
            const allRegistered = await getRegisteredProjects();
            const runnable: ProjEnvProject[] = await getRunnableProjects();
            
            // Debug logging
            ExtensionOutputChannel.debug('ProjectManager', `[PROJECT DISCOVERY] Total registered projects: ${allRegistered.length}`);
            ExtensionOutputChannel.debug('ProjectManager', `[PROJECT DISCOVERY] Runnable projects: ${runnable.length}`);
            
            // Log all registered projects with their runnable status
            allRegistered.forEach(p => {
                const isRunnable = p.isRunnable();
                const status = isRunnable ? 'WILL SHOW' : 'FILTERED OUT';
                ExtensionOutputChannel.debug('ProjectManager', `[PROJECT DISCOVERY]   ${p.getName()} (ID: ${p.getId()}) - runnable=${isRunnable} (${status})`);
            });
            
            // Log filtered out projects
            const notRunnable = allRegistered.filter(p => !p.isRunnable());
            if (notRunnable.length > 0) {
                ExtensionOutputChannel.warn('ProjectManager', `[PROJECT DISCOVERY] Filtered out ${notRunnable.length} non-runnable project(s):`);
                notRunnable.forEach(p => {
                    ExtensionOutputChannel.warn('ProjectManager', `[PROJECT DISCOVERY]   - ${p.getName()} (ID: ${p.getId()})`);
                });
            }
            
            // Show all projects immediately with "Unknown" status
            this._runningProjects = runnable.map(p => toProjectInfo(p, 'unknown'));
            this._onDidChangeProjects.fire(); // Trigger TreeView refresh
            
            ExtensionOutputChannel.info('ProjectManager', `Loaded ${runnable.length} projects with unknown status`);
        } catch (error) {
            ExtensionOutputChannel.error('ProjectManager', 'Failed to load projects', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Phase 2: Load project status sequentially (progressive UX)
     */
    private async loadProjectStatusProgressive(): Promise<void> {
        const runnable: ProjEnvProject[] = await getRunnableProjects();
        ExtensionOutputChannel.info('ProjectManager', `[PROGRESSIVE LOAD] Checking status for ${runnable.length} project(s)`);
        
        for (const project of runnable) {
            const projectId = project.getId();
            
            // Skip projects that previously failed (cached errors)
            if (this._failedProjects.has(projectId)) {
                const cachedError = this._runningProjects.find(p => p.id === projectId);
                if (cachedError) {
                    ExtensionOutputChannel.debug('ProjectManager', `[PROGRESSIVE LOAD] Skipping ${projectId} (cached error)`);
                }
                continue;
            }
            
            ExtensionOutputChannel.debug('ProjectManager', `[PROGRESSIVE LOAD] Polling PMON for project: ${projectId}`);
            try {
                const isRunning = await project.isPmonRunning();
                const statusText = isRunning ? 'running' : 'stopped';
                ExtensionOutputChannel.info('ProjectManager', `[PROGRESSIVE LOAD] ${projectId} → ${statusText.toUpperCase()}`);
                this.updateProjectStatus(projectId, isRunning ? 'running' : 'stopped');
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                ExtensionOutputChannel.warn('ProjectManager', `[PROGRESSIVE LOAD] ${projectId} → ERROR: ${errorMsg}`);
                
                // Cache this project as failed
                this._failedProjects.add(projectId);
                this.updateProjectStatus(projectId, 'error', errorMsg);
            }
        }
        
        this._isInitialLoad = false;
        ExtensionOutputChannel.info('ProjectManager', 'Progressive status loading completed');
    }

    /**
     * Update single project status and refresh TreeView
     */
    private updateProjectStatus(projectId: string, status: ProjectStatus, error?: string): void {
        const index = this._runningProjects.findIndex(p => p.id === projectId);
        if (index === -1) {
            ExtensionOutputChannel.warn('ProjectManager', `[UPDATE] Project ${projectId} not found in cache`);
            return;
        }
        
        const project = this._runningProjects[index];
        ExtensionOutputChannel.debug('ProjectManager', `[UPDATE] ${projectId} → ${status.toUpperCase()}${error ? ` (${error})` : ''}`);
        this._runningProjects[index] = {
            ...project,
            status: status,
            isRunning: status === 'running',
            error: error,
            hasError: status === 'error'
        };
        
        // Update current project if it's the same
        if (this._currentProject && this._currentProject.id === projectId) {
            this._currentProject = this._runningProjects[index];
            this.saveState();
            this._onDidChangeProject.fire(this._currentProject); // Fire event for status bar update!
        }
        
        this._onDidChangeProjects.fire(); // Trigger TreeView refresh
    }

    /**
     * Phase 3: Smart polling - only running/transitioning projects + current project (stopped are ignored)
     */
    private async refreshSmartPolling(): Promise<void> {
        try {
            // Poll running/transitioning projects + ALWAYS poll current project (even if stopped)
            const projectsToCheck = this._runningProjects.filter(p => 
                p.status === 'running' || 
                p.status === 'transitioning' ||
                (this._currentProject && p.id === this._currentProject.id) // Always check current project
            );
            const stoppedCount = this._runningProjects.filter(p => p.status === 'stopped').length;
            const errorCount = this._runningProjects.filter(p => p.status === 'error').length;
            
            ExtensionOutputChannel.info('ProjectManager', `[SMART POLL] Checking ${projectsToCheck.length} project(s) (${stoppedCount} stopped, ${errorCount} error - skipped${this._currentProject ? ', +current' : ''})`);
            
            if (projectsToCheck.length === 0) {
                ExtensionOutputChannel.debug('ProjectManager', '[SMART POLL] No projects to check');
                return;
            }
            
            for (const project of projectsToCheck) {
                const projectId = project.id;
                
                ExtensionOutputChannel.debug('ProjectManager', `[SMART POLL] Polling project: ${projectId} (current: ${project.status})`);
                
                try {
                    // Re-fetch project instance (we only have ProjectInfo, not ProjEnvProject)
                    const runnable = await getRunnableProjects();
                    const projEnv = runnable.find(p => p.getId() === projectId);
                    if (!projEnv) {
                        ExtensionOutputChannel.warn('ProjectManager', `[SMART POLL] ${projectId} not found in runnable projects`);
                        continue;
                    }
                    
                    const isRunning = await projEnv.isPmonRunning();
                    const newStatus: ProjectStatus = isRunning ? 'running' : 'stopped';
                    
                    // Only update if status changed
                    if (project.status !== newStatus) {
                        ExtensionOutputChannel.info('ProjectManager', `[SMART POLL] ${projectId} status changed: ${project.status.toUpperCase()} → ${newStatus.toUpperCase()}`);
                        this.updateProjectStatus(projectId, newStatus);
                    } else {
                        ExtensionOutputChannel.debug('ProjectManager', `[SMART POLL] ${projectId} status unchanged: ${newStatus}`);
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    ExtensionOutputChannel.warn('ProjectManager', `[SMART POLL] ${projectId} → ERROR: ${errorMsg}`);
                    
                    // Mark as error if previously running
                    if (project.status === 'running') {
                        this._failedProjects.add(projectId);
                        this.updateProjectStatus(projectId, 'error', errorMsg);
                    }
                }
            }
        } catch (error) {
            ExtensionOutputChannel.error('ProjectManager', 'Smart polling failed', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Force full refresh of ALL projects (for manual refresh button)
     */
    async forceRefreshAll(): Promise<void> {
        ExtensionOutputChannel.info('ProjectManager', 'Force refreshing all projects...');
        
        // Clear error cache to retry failed projects
        this._failedProjects.clear();
        
        // Re-run progressive loading
        await this.loadProjectsInitial();
        await this.loadProjectStatusProgressive();
    }

    /**
     * Quick verification: Only check if current project is still running
     * Used by status bar picker - fast check without reloading entire list
     */
    async verifyCurrentProject(): Promise<void> {
        if (!this._currentProject) {
            return;
        }

        const projectId = this._currentProject.id;
        ExtensionOutputChannel.debug('ProjectManager', `[VERIFY] Quick check for current project: ${projectId}`);

        try {
            const runnable: ProjEnvProject[] = await getRunnableProjects();
            const project = runnable.find(p => p.getId() === projectId);

            if (!project) {
                ExtensionOutputChannel.warn('ProjectManager', `[VERIFY] Current project ${projectId} no longer found`);
                this.updateProjectStatus(projectId, 'error', 'Project not found');
                return;
            }

            const isRunning = await project.isPmonRunning();
            const newStatus = isRunning ? 'running' : 'stopped';
            
            if (this._currentProject.status !== newStatus) {
                ExtensionOutputChannel.info('ProjectManager', `[VERIFY] Current project status changed: ${this._currentProject.status} → ${newStatus}`);
                this.updateProjectStatus(projectId, newStatus);
            } else {
                ExtensionOutputChannel.debug('ProjectManager', `[VERIFY] Current project status unchanged: ${newStatus}`);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            ExtensionOutputChannel.warn('ProjectManager', `[VERIFY] Failed to verify current project: ${errorMsg}`);
            this.updateProjectStatus(projectId, 'error', errorMsg);
        }
    }

    /**
     * Refresh list of running projects from shared library (LEGACY - for manual refresh button)
     * TODO: Remove after TreeView uses onDidChangeProjects event
     */
    async refreshProjects(): Promise<void> {
        // Always do full refresh when user clicks button
        await this.forceRefreshAll();
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
        this._onDidChangeProjects.dispose();
    }
}
