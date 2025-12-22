import type { ProjEnvProject } from '@winccoa-tools-pack/core-utils';

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
    /** Is project currently running */
    isRunning: boolean;
}

/**
 * Convert ProjEnvProject to simplified ProjectInfo
 */
export function toProjectInfo(project: ProjEnvProject): ProjectInfo {
    return {
        id: project.getId(),
        name: project.getName() || project.getId(),
        installDir: project.getInstallDir() || '',
        projectDir: project.getDir(),
        version: project.getVersion() || 'unknown',
        isRunning: project.isRunning()
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
