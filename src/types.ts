import type { ProjEnvProject } from '@winccoa-tools-pack/core-utils';
import { getWinCCOAInstallationPathByVersion } from '@winccoa-tools-pack/core-utils';

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
    /** Is project currently running */
    isRunning: boolean;
}

/**
 * Convert ProjEnvProject to simplified ProjectInfo
 */
export function toProjectInfo(project: ProjEnvProject): ProjectInfo {
    const version = project.getVersion() || 'unknown';
    const oaInstallPath = version !== 'unknown' 
        ? getWinCCOAInstallationPathByVersion(version) || ''
        : '';
    
    return {
        id: project.getId(),
        name: project.getName() || project.getId(),
        installDir: project.getInstallDir() || '',
        projectDir: project.getDir(),
        version: version,
        oaInstallPath: oaInstallPath,
        configPath: project.getConfigPath(),
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
