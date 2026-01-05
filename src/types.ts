import type { ProjEnvProject } from '@winccoa-tools-pack/npm-winccoa-core';
import { getWinCCOAInstallationPathByVersion } from '@winccoa-tools-pack/npm-winccoa-core';

/**
 * Project status states
 */
export type ProjectStatus = 'unknown' | 'running' | 'stopped' | 'transitioning' | 'error';

/**
 * Simplified project info for extension API
 */
export interface ProjectInfo {
    /** Project ID/name */
    id: string;
    /** Project name */
    name: string;
    /** Project installation directory */
    installDir: string;
    /** Project directory (installDir + id) */
    projectDir: string;
    /** WinCC OA version */
    version: string;
    /** WinCC OA installation path (e.g. /opt/WinCC_OA/3.20) */
    oaInstallPath: string;
    /** Config file path (projectDir/config/config) */
    configPath: string;
    /** Project status (unknown, running, stopped, transitioning, error) */
    status: ProjectStatus;
    /** Is project currently running (deprecated, use status instead) */
    isRunning: boolean;
    /** Error message if project failed to load/check status */
    error?: string;
    /** Flag indicating project has an error (deprecated, use status === 'error') */
    hasError?: boolean;
}

/**
 * Convert ProjEnvProject to simplified ProjectInfo
 * @param project - The project to convert
 * @param status - Project status (unknown, running, stopped, transitioning, error)
 * @param error - Optional error message if project failed to load
 */
export function toProjectInfo(project: ProjEnvProject, status: ProjectStatus = 'unknown', error?: string): ProjectInfo {
    const version = project.getVersion() || 'unknown';
    const oaInstallPath = version !== 'unknown' 
        ? getWinCCOAInstallationPathByVersion(version) || ''
        : '';
    
    console.log('[ProjectInfo] Converting project:', {
        id: project.getId(),
        version: version,
        status: status,
        oaInstallPath: oaInstallPath,
        configPath: project.getConfigPath()
    });
    
    return {
        id: project.getId(),
        name: project.getName() || project.getId(),
        installDir: project.getInstallDir() || '',
        projectDir: project.getDir(),
        version: version,
        oaInstallPath: oaInstallPath,
        configPath: project.getConfigPath(),
        status: status,
        isRunning: status === 'running',  // Backward compatibility
        error: error,
        hasError: status === 'error'      // Backward compatibility
    };
}

/**
 * Public API exported by this extension
 */
export interface WinCCOACoreAPI {
    /**
     * Get currently selected project
     */
    getCurrentProject(): ProjectInfo | undefined;

    /**
     * Set current project by ID
     */
    setCurrentProject(projectId: string): Promise<boolean>;

    /**
     * Get all running projects
     */
    getRunningProjects(): Promise<ProjectInfo[]>;

    /**
     * Event fired when the current project changes
     */
    onDidChangeProject: (listener: (project: ProjectInfo | undefined) => void) => void;
}
