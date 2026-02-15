import * as fs from 'fs';
import * as path from 'path';
import type { ProjEnvProject } from '@winccoa-tools-pack/npm-winccoa-core';
import { getWinCCOAInstallationPathByVersion, getAvailableWinCCOAVersions } from '@winccoa-tools-pack/npm-winccoa-core';

/**
 * Project status states
 */
export type ProjectStatus = 'unknown' | 'running' | 'stopped' | 'transitioning' | 'error';

/**
 * Parse WinCC OA version from project config/config file
 * Used when npm-core getVersion() fails or returns invalid version
 * @param project - The project to parse version for
 * @returns Normalized version (e.g., "3.21") or null if parsing fails
 */
function parseVersionFromProjectConfig(project: ProjEnvProject): string | null {
    try {
        const projectPath = project.getDir();
        if (!projectPath) {
            console.warn('[ProjectInfo] Cannot parse config - project path is empty');
            return null;
        }

        const configPath = path.join(projectPath, 'config', 'config');
        if (!fs.existsSync(configPath)) {
            console.warn(`[ProjectInfo] Config file not found: ${configPath}`);
            return null;
        }

        const configContent = fs.readFileSync(configPath, 'utf-8');
        
        // Parse proj_version = "X.XX" or proj_version = "X.XX.X"
        const versionMatch = configContent.match(/proj_version\s*=\s*"([0-9]+\.[0-9]+(?:\.[0-9]+)?)"/i);
        
        if (versionMatch && versionMatch[1]) {
            const version = versionMatch[1];
            // Normalize to major.minor format (e.g., "3.21.1" -> "3.21")
            const normalized = version.split('.').slice(0, 2).join('.');
            console.log(`[ProjectInfo] Parsed version from config: ${version} (normalized: ${normalized})`);
            
            // Validate version exists on system
            const availableVersions = getAvailableWinCCOAVersions();
            if (!availableVersions.includes(normalized)) {
                console.warn(`[ProjectInfo] Parsed version ${normalized} not found on system (available: ${availableVersions.join(', ')})`);
                return null;
            }
            
            return normalized;
        }
        
        console.warn(`[ProjectInfo] No proj_version found in ${configPath}`);
        return null;
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`[ProjectInfo] Failed to parse version from config: ${err.message}`);
        return null;
    }
}

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
    // Get version from npm-core, fallback to config parsing if invalid
    let version = project.getVersion() || 'unknown';
    
    if (!version || version === 'unknown' || version.trim() === '') {
        console.log('[ProjectInfo] Version from npm-core is invalid, parsing from config...');
        const configVersion = parseVersionFromProjectConfig(project);
        if (configVersion) {
            version = configVersion;
            // CRITICAL: Set version in ProjEnvProject so future calls return correct version
            project.setVersion(configVersion);
            console.log(`[ProjectInfo] Using version from config: ${version} (set in ProjEnvProject)`);
        } else {
            console.warn('[ProjectInfo] Failed to parse version from config, keeping "unknown"');
        }
    }
    
    const oaInstallPath = version !== 'unknown' 
        ? getWinCCOAInstallationPathByVersion(version) || ''
        : '';
    
    console.log('[ProjectInfo] Converting project:', {
        id: project.getId(),
        version: version,
        status: status,
        oaInstallPath: oaInstallPath,
        configPath: project.getConfigPath(),
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
        isRunning: status === 'running', // Backward compatibility
        error: error,
        hasError: status === 'error', // Backward compatibility
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
