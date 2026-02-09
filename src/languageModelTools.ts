/**
 * Language Model Tools for GitHub Copilot
 *
 * Provides WinCC OA project management and control tools for AI assistants.
 * Enables autonomous project operations, PMON control, and manager management.
 */

import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';
import { ExtensionOutputChannel } from './extensionOutput';
import { SystemTreeProvider } from './views/systemTreeProvider';
import { ManagerTreeProvider } from './views/managerTreeProvider';
import { ProjEnvManagerState } from '@winccoa-tools-pack/npm-winccoa-core';
import type { ProjectInfo } from './types';

/**
 * Language Model Tools Service
 *
 * Registers project management tools for GitHub Copilot autonomous access.
 */
export class LanguageModelToolsService {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private projectManager: ProjectManager,
        private systemTreeProvider: SystemTreeProvider,
        private managerTreeProvider: ManagerTreeProvider,
    ) {}

    /**
     * Register all Language Model Tools
     */
    register(context: vscode.ExtensionContext): void {
        console.log('[LanguageModelTools] Registering WinCC OA Project Admin Tools...');

        // Project Management Tools
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_list_projects',
                new ListProjectsTool(this.projectManager),
            ),
        );

        ExtensionOutputChannel.debug(
            'LanguageModelTools',
            'Registering winccoa_get_project_info...',
        );
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_get_project_info',
                new GetProjectInfoTool(this.projectManager),
            ),
        );
        ExtensionOutputChannel.info(
            'LanguageModelTools',
            '✅ Registered: winccoa_get_project_info',
        );

        ExtensionOutputChannel.debug(
            'LanguageModelTools',
            'Registering winccoa_set_active_project...',
        );
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_set_active_project',
                new SetActiveProjectTool(this.projectManager),
            ),
        );
        ExtensionOutputChannel.info(
            'LanguageModelTools',
            '✅ Registered: winccoa_set_active_project',
        );

        // PMON Control Tools
        ExtensionOutputChannel.debug('LanguageModelTools', 'Registering winccoa_start_project...');
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_start_project',
                new StartProjectTool(this.projectManager, this.systemTreeProvider),
            ),
        );
        ExtensionOutputChannel.info('LanguageModelTools', '✅ Registered: winccoa_start_project');

        ExtensionOutputChannel.debug('LanguageModelTools', 'Registering winccoa_stop_project...');
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_stop_project',
                new StopProjectTool(this.projectManager, this.systemTreeProvider),
            ),
        );
        ExtensionOutputChannel.info('LanguageModelTools', '✅ Registered: winccoa_stop_project');

        ExtensionOutputChannel.debug(
            'LanguageModelTools',
            'Registering winccoa_get_pmon_status...',
        );
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_get_pmon_status',
                new GetPmonStatusTool(this.projectManager),
            ),
        );
        ExtensionOutputChannel.info('LanguageModelTools', '✅ Registered: winccoa_get_pmon_status');

        // Manager Control Tools
        ExtensionOutputChannel.debug(
            'LanguageModelTools',
            'Registering winccoa_project_managers...',
        );
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_project_managers',
                new ListManagersTool(this.projectManager, this.managerTreeProvider),
            ),
        );
        ExtensionOutputChannel.info(
            'LanguageModelTools',
            '✅ Registered: winccoa_project_managers',
        );

        ExtensionOutputChannel.debug('LanguageModelTools', 'Registering winccoa_start_manager...');
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_start_manager',
                new StartManagerTool(this.projectManager, this.managerTreeProvider),
            ),
        );
        ExtensionOutputChannel.info('LanguageModelTools', '✅ Registered: winccoa_start_manager');

        ExtensionOutputChannel.debug('LanguageModelTools', 'Registering winccoa_stop_manager...');
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_stop_manager',
                new StopManagerTool(this.projectManager, this.managerTreeProvider),
            ),
        );
        ExtensionOutputChannel.info('LanguageModelTools', '✅ Registered: winccoa_stop_manager');

        ExtensionOutputChannel.debug(
            'LanguageModelTools',
            'Registering winccoa_restart_manager...',
        );
        this.disposables.push(
            vscode.lm.registerTool(
                'winccoa_restart_manager',
                new RestartManagerTool(this.projectManager, this.managerTreeProvider),
            ),
        );
        ExtensionOutputChannel.info('LanguageModelTools', '✅ Registered: winccoa_restart_manager');

        // Add to context subscriptions
        context.subscriptions.push(...this.disposables);

        ExtensionOutputChannel.success(
            'LanguageModelTools',
            `🎉 Successfully registered ${this.disposables.length} Language Model Tools!`,
        );

        console.log('[LanguageModelTools] ✅ Registered 10 WinCC OA Project Admin Tools');
    }

    /**
     * Dispose all registered tools
     */
    dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
}

// ============================================================================
// Tool 1: List Projects
// ============================================================================

interface ListProjectsInput {
    statusFilter?: 'all' | 'running' | 'stopped' | 'error';
}

class ListProjectsTool implements vscode.LanguageModelTool<ListProjectsInput> {
    constructor(private projectManager: ProjectManager) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ListProjectsInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        __token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log(
                '[ListProjectsTool] Querying projects with filter:',
                input.statusFilter || 'all',
            );
            ExtensionOutputChannel.debug(
                'LanguageModelTool',
                `List projects: filter=${input.statusFilter || 'all'}`,
            );

            // Get all runnable projects
            const allProjects = await this.projectManager.getAllRunnableProjects();

            // Apply status filter
            let projects = allProjects;
            if (input.statusFilter && input.statusFilter !== 'all') {
                projects = allProjects.filter((p) => p.status === input.statusFilter);
            }

            // Format response
            const projectList = projects.map((p) => ({
                id: p.id,
                name: p.name,
                version: p.version,
                status: p.status,
                path: p.projectDir,
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            count: projectList.length,
                            projects: projectList,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'List projects failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 2: Get Project Info
// ============================================================================

interface GetProjectInfoInput {
    projectId: string;
}

class GetProjectInfoTool implements vscode.LanguageModelTool<GetProjectInfoInput> {
    constructor(private projectManager: ProjectManager) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetProjectInfoInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log('[GetProjectInfoTool] Getting info for:', input.projectId);
            ExtensionOutputChannel.debug(
                'LanguageModelTool',
                `Get project info: ${input.projectId}`,
            );

            if (!input.projectId) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: 'projectId is required',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Find project
            const allProjects = await this.projectManager.getAllRunnableProjects();
            const project = allProjects.find((p) => p.id === input.projectId);

            if (!project) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Project '${input.projectId}' not found`,
                                availableProjects: allProjects.map((p) => p.id),
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Format detailed response
            const projectInfo = {
                id: project.id,
                name: project.name,
                version: project.version,
                status: project.status,
                isRunning: project.isRunning,
                projectDir: project.projectDir,
                installDir: project.installDir,
                oaInstallPath: project.oaInstallPath,
                configPath: project.configPath,
            };

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            project: projectInfo,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'Get project info failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 3: Set Active Project
// ============================================================================

interface SetActiveProjectInput {
    projectId: string;
}

class SetActiveProjectTool implements vscode.LanguageModelTool<SetActiveProjectInput> {
    constructor(private projectManager: ProjectManager) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<SetActiveProjectInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log('[SetActiveProjectTool] Setting active project to:', input.projectId);
            ExtensionOutputChannel.debug(
                'LanguageModelTool',
                `Set active project: ${input.projectId}`,
            );

            if (!input.projectId) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: 'projectId is required',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            const previousProject = this.projectManager.getCurrentProject();
            const success = await this.projectManager.setCurrentProject(input.projectId);

            if (!success) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Failed to set active project to '${input.projectId}'`,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            message: `Active project set to '${input.projectId}'`,
                            previousProject: previousProject?.id || null,
                            newProject: input.projectId,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'Set active project failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 4: Start Project
// ============================================================================

interface StartProjectInput {
    projectId: string;
    waitForStartup?: boolean;
}

class StartProjectTool implements vscode.LanguageModelTool<StartProjectInput> {
    constructor(
        private projectManager: ProjectManager,
        private systemTreeProvider: SystemTreeProvider,
    ) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<StartProjectInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log('[StartProjectTool] Starting project:', input.projectId);
            ExtensionOutputChannel.debug('LanguageModelTool', `Start project: ${input.projectId}`);

            if (!input.projectId) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: 'projectId is required',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Find project
            const allProjects = await this.projectManager.getAllRunnableProjects();
            const project = allProjects.find((p) => p.id === input.projectId);

            if (!project) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Project '${input.projectId}' not found`,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Check if already running
            if (project.isRunning) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: true,
                                message: `Project '${input.projectId}' is already running`,
                                wasAlreadyRunning: true,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Start project via SystemTreeProvider
            await this.systemTreeProvider.startProject(project);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            message: `Project '${input.projectId}' started successfully`,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'Start project failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 5: Stop Project
// ============================================================================

interface StopProjectInput {
    projectId: string;
    timeout?: number;
}

class StopProjectTool implements vscode.LanguageModelTool<StopProjectInput> {
    constructor(
        private projectManager: ProjectManager,
        private systemTreeProvider: SystemTreeProvider,
    ) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<StopProjectInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log('[StopProjectTool] Stopping project:', input.projectId);
            ExtensionOutputChannel.debug('LanguageModelTool', `Stop project: ${input.projectId}`);

            if (!input.projectId) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: 'projectId is required',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Find project
            const allProjects = await this.projectManager.getAllRunnableProjects();
            const project = allProjects.find((p) => p.id === input.projectId);

            if (!project) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Project '${input.projectId}' not found`,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Check if already stopped
            if (!project.isRunning) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: true,
                                message: `Project '${input.projectId}' is already stopped`,
                                wasAlreadyStopped: true,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Stop project via SystemTreeProvider
            await this.systemTreeProvider.stopProject(project);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            message: `Project '${input.projectId}' stopped successfully`,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'Stop project failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 6: Get PMON Status
// ============================================================================

interface GetPmonStatusInput {
    projectId: string;
}

class GetPmonStatusTool implements vscode.LanguageModelTool<GetPmonStatusInput> {
    constructor(private projectManager: ProjectManager) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetPmonStatusInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log('[GetPmonStatusTool] Getting PMON status for:', input.projectId);
            ExtensionOutputChannel.debug(
                'LanguageModelTool',
                `Get PMON status: ${input.projectId}`,
            );

            if (!input.projectId) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: 'projectId is required',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Find project
            const allProjects = await this.projectManager.getAllRunnableProjects();
            const project = allProjects.find((p) => p.id === input.projectId);

            if (!project) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Project '${input.projectId}' not found`,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            projectId: input.projectId,
                            pmonStatus: {
                                running: project.isRunning,
                                status: project.status,
                            },
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'Get PMON status failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 7: List Managers
// ============================================================================

interface ListManagersInput {
    projectId?: string;
    statusFilter?: 'all' | 'running' | 'stopped';
}

class ListManagersTool implements vscode.LanguageModelTool<ListManagersInput> {
    constructor(
        private projectManager: ProjectManager,
        private managerTreeProvider: ManagerTreeProvider,
    ) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ListManagersInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log(
                '[ListManagersTool] Listing managers for:',
                input.projectId || 'current project',
            );
            ExtensionOutputChannel.debug(
                'LanguageModelTool',
                `List managers: ${input.projectId || 'current'}`,
            );

            // Determine which project to use
            let project: ProjectInfo | undefined;
            if (input.projectId) {
                const allProjects = await this.projectManager.getAllRunnableProjects();
                project = allProjects.find((p) => p.id === input.projectId);

                if (!project) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify(
                                {
                                    success: false,
                                    error: `Project '${input.projectId}' not found`,
                                },
                                null,
                                2,
                            ),
                        ),
                    ]);
                }
            } else {
                project = this.projectManager.getCurrentProject();

                if (!project) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify(
                                {
                                    success: false,
                                    error: 'No project specified and no active project set',
                                },
                                null,
                                2,
                            ),
                        ),
                    ]);
                }
            }

            // Get managers from ManagerTreeProvider
            const managerData = this.managerTreeProvider.getManagers();
            const currentProjectId = this.managerTreeProvider.getCurrentProjectId();

            if (currentProjectId !== project.id) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Manager data is for different project. Expected '${
                                    project.id
                                }', got '${currentProjectId || 'none'}'`,
                                note: 'Set the project as active first or wait for manager data to load',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Build manager list from ManagerTreeProvider data
            const allManagers = managerData.map((m) => ({
                num: m.idx,
                name: m.options?.component || `Manager_${m.idx}`,
                state: m.info.state,
                mode: m.info.startMode,
                secKill: m.options?.secondToKill || 0,
                pid: m.info.pid,
                startTime: m.info.startTime,
            }));

            // Apply status filter
            let managers = allManagers;
            if (input.statusFilter && input.statusFilter !== 'all') {
                const targetState =
                    input.statusFilter === 'running'
                        ? ProjEnvManagerState.Running
                        : ProjEnvManagerState.NotRunning;
                managers = allManagers.filter((m) => m.state === targetState);
            }

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            projectId: project.id,
                            count: managers.length,
                            managers: managers,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'List managers failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 8: Start Manager
// ============================================================================

interface StartManagerInput {
    managerNum: number;
    projectId?: string;
}

class StartManagerTool implements vscode.LanguageModelTool<StartManagerInput> {
    constructor(
        private projectManager: ProjectManager,
        private managerTreeProvider: ManagerTreeProvider,
    ) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<StartManagerInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log('[StartManagerTool] Starting manager:', input.managerNum);
            ExtensionOutputChannel.debug('LanguageModelTool', `Start manager: ${input.managerNum}`);

            if (!input.managerNum) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: 'managerNum is required',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Determine which project to use
            let project: ProjectInfo | undefined;
            if (input.projectId) {
                const allProjects = await this.projectManager.getAllRunnableProjects();
                project = allProjects.find((p) => p.id === input.projectId);

                if (!project) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify(
                                {
                                    success: false,
                                    error: `Project '${input.projectId}' not found`,
                                },
                                null,
                                2,
                            ),
                        ),
                    ]);
                }
            } else {
                project = this.projectManager.getCurrentProject();

                if (!project) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify(
                                {
                                    success: false,
                                    error: 'No project specified and no active project set',
                                },
                                null,
                                2,
                            ),
                        ),
                    ]);
                }
            }

            // Find the manager data
            const managerData = this.managerTreeProvider.getManagers();
            const manager = managerData.find((m) => m.idx === input.managerNum);

            if (!manager) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Manager ${input.managerNum} not found`,
                                availableManagers: managerData.map((m) => m.idx),
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Start manager via ManagerTreeProvider
            await this.managerTreeProvider.startManager(manager);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            message: `Manager ${input.managerNum} started successfully`,
                            projectId: project.id,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'Start manager failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 9: Stop Manager
// ============================================================================

interface StopManagerInput {
    managerNum: number;
    projectId?: string;
}

class StopManagerTool implements vscode.LanguageModelTool<StopManagerInput> {
    constructor(
        private projectManager: ProjectManager,
        private managerTreeProvider: ManagerTreeProvider,
    ) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<StopManagerInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log('[StopManagerTool] Stopping manager:', input.managerNum);
            ExtensionOutputChannel.debug('LanguageModelTool', `Stop manager: ${input.managerNum}`);

            if (!input.managerNum) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: 'managerNum is required',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Determine which project to use
            let project: ProjectInfo | undefined;
            if (input.projectId) {
                const allProjects = await this.projectManager.getAllRunnableProjects();
                project = allProjects.find((p) => p.id === input.projectId);

                if (!project) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify(
                                {
                                    success: false,
                                    error: `Project '${input.projectId}' not found`,
                                },
                                null,
                                2,
                            ),
                        ),
                    ]);
                }
            } else {
                project = this.projectManager.getCurrentProject();

                if (!project) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify(
                                {
                                    success: false,
                                    error: 'No project specified and no active project set',
                                },
                                null,
                                2,
                            ),
                        ),
                    ]);
                }
            }

            // Find the manager data
            const managerData = this.managerTreeProvider.getManagers();
            const manager = managerData.find((m) => m.idx === input.managerNum);

            if (!manager) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Manager ${input.managerNum} not found`,
                                availableManagers: managerData.map((m) => m.idx),
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Stop manager via ManagerTreeProvider
            await this.managerTreeProvider.stopManager(manager);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            message: `Manager ${input.managerNum} stopped successfully`,
                            projectId: project.id,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'Stop manager failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

// ============================================================================
// Tool 10: Restart Manager
// ============================================================================

interface RestartManagerInput {
    managerNum: number;
    projectId?: string;
}

class RestartManagerTool implements vscode.LanguageModelTool<RestartManagerInput> {
    constructor(
        private projectManager: ProjectManager,
        private managerTreeProvider: ManagerTreeProvider,
    ) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<RestartManagerInput>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log('[RestartManagerTool] Restarting manager:', input.managerNum);
            ExtensionOutputChannel.debug(
                'LanguageModelTool',
                `Restart manager: ${input.managerNum}`,
            );

            if (!input.managerNum) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: 'managerNum is required',
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Determine which project to use
            let project: ProjectInfo | undefined;
            if (input.projectId) {
                const allProjects = await this.projectManager.getAllRunnableProjects();
                project = allProjects.find((p) => p.id === input.projectId);

                if (!project) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify(
                                {
                                    success: false,
                                    error: `Project '${input.projectId}' not found`,
                                },
                                null,
                                2,
                            ),
                        ),
                    ]);
                }
            } else {
                project = this.projectManager.getCurrentProject();

                if (!project) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify(
                                {
                                    success: false,
                                    error: 'No project specified and no active project set',
                                },
                                null,
                                2,
                            ),
                        ),
                    ]);
                }
            }

            // Find the manager data
            const managerData = this.managerTreeProvider.getManagers();
            const manager = managerData.find((m) => m.idx === input.managerNum);

            if (!manager) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify(
                            {
                                success: false,
                                error: `Manager ${input.managerNum} not found`,
                                availableManagers: managerData.map((m) => m.idx),
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            // Restart manager via ManagerTreeProvider
            await this.managerTreeProvider.restartManager(manager);

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            message: `Manager ${input.managerNum} restarted successfully`,
                            projectId: project.id,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            ExtensionOutputChannel.error('LanguageModelTool', 'Restart manager failed', err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: err.message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}
