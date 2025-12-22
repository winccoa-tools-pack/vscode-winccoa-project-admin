// Example: How other extensions use the Core API

import * as vscode from 'vscode';

async function useWinCCOACore() {
    // 1. Get the Core Extension
    const coreExtension = vscode.extensions.getExtension('winccoa-tools-pack.winccoa-core');
    
    if (!coreExtension) {
        vscode.window.showErrorMessage('WinCC OA Core extension not installed');
        return;
    }
    
    // 2. Activate it (if not already active)
    const coreAPI = await coreExtension.activate();
    
    // 3. Get current project
    const currentProject = coreAPI.getCurrentProject();
    
    if (currentProject) {
        console.log('Current Project:', currentProject.name);
        console.log('Version:', currentProject.version);
        console.log('Project Path:', currentProject.projectDir);
        console.log('OA Install:', currentProject.oaInstallPath);
        console.log('Config Path:', currentProject.configPath);
        
        // Use the paths for your extension
        // e.g., read config file, find scripts, etc.
    }
    
    // 4. Listen for project changes
    coreAPI.onDidChangeProject((project) => {
        if (project) {
            console.log('Project changed to:', project.name);
            // Update your extension when user switches projects
        } else {
            console.log('No project selected');
        }
    });
    
    // 5. Get all running projects
    const runningProjects = await coreAPI.getRunningProjects();
    console.log(`Found ${runningProjects.length} running projects`);
    
    // 6. Switch to different project
    await coreAPI.setCurrentProject('DevEnv');
}

// In your extension's package.json, add:
// "extensionDependencies": [
//     "winccoa-tools-pack.winccoa-core"
// ]
