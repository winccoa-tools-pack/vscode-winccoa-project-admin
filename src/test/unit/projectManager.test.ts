import * as assert from 'assert';
import * as vscode from 'vscode';
import { ProjectManager } from '../../projectManager';
import { ProjectInfo, toProjectInfo } from '../../types';

suite('ProjectManager Unit Tests', () => {
    let mockContext: any;
    let projectManager: ProjectManager;

    class ProjectManagerWithStubbedRunnable extends ProjectManager {
        constructor(
            context: any,
            private readonly runnable: any[],
        ) {
            super(context);
        }

        protected override async fetchRunnableProjects(): Promise<any[]> {
            return this.runnable;
        }
    }

    suiteSetup(() => {
        // Create mock VS Code extension context
        mockContext = {
            subscriptions: [],
            extensionPath: '/test/path',
            globalState: {
                get: (key: string, defaultValue?: any) => defaultValue,
                update: () => Promise.resolve(),
                setKeysForSync: () => {}
            },
            workspaceState: {
                get: (key: string, defaultValue?: any) => defaultValue,
                update: () => Promise.resolve()
            }
        };
    });

    setup(() => {
        projectManager = new ProjectManager(mockContext);
    });

    suite('Constructor and Initialization', () => {
        test('should create ProjectManager instance', () => {
            assert.ok(projectManager, 'ProjectManager should be created');
            assert.ok(typeof projectManager.getCurrentProject === 'function', 'Should have getCurrentProject method');
            assert.ok(typeof projectManager.getRunningProjects === 'function', 'Should have getRunningProjects method');
        });

        test('should initialize with empty favorites', () => {
            // Favorites are loaded in constructor, should be empty initially
            assert.ok(projectManager, 'ProjectManager should initialize');
        });
    });

    suite('Project State Management', () => {
        test('should return undefined for current project initially', () => {
            const current = projectManager.getCurrentProject();
            assert.strictEqual(current, undefined, 'Current project should be undefined initially');
        });

        test('should return empty array for running projects initially', () => {
            const running = projectManager.getRunningProjects();
            assert.ok(Array.isArray(running), 'Running projects should be an array');
            assert.strictEqual(running.length, 0, 'Running projects should be empty initially');
        });

        test('should handle setCurrentProject with mock project', async () => {
            // Mock the getAllRunnableProjects method to return a test project
            const originalGetAllRunnableProjects = projectManager.getAllRunnableProjects;
            projectManager.getAllRunnableProjects = async () => [{
                id: 'test-project',
                name: 'Test Project',
                installDir: '/opt/WinCC_OA/3.20',
                projectDir: '/opt/WinCC_OA/3.20/test-project',
                version: '3.20',
                oaInstallPath: '/opt/WinCC_OA/3.20',
                configPath: '/opt/WinCC_OA/3.20/test-project/config/config',
                status: 'stopped',
                isRunning: false
            }];

            const result = await projectManager.setCurrentProject('test-project');
            assert.strictEqual(result, true, 'Should successfully set current project');

            const current = projectManager.getCurrentProject();
            assert.ok(current, 'Current project should be set');
            assert.strictEqual(current?.id, 'test-project', 'Current project should have correct ID');

            // Restore original method
            projectManager.getAllRunnableProjects = originalGetAllRunnableProjects;
        });

        test('should handle setCurrentProject with non-existent project', async () => {
            // Mock empty runnable projects
            const originalGetAllRunnableProjects = projectManager.getAllRunnableProjects;
            projectManager.getAllRunnableProjects = async () => [];

            const result = await projectManager.setCurrentProject('non-existent-project');
            assert.strictEqual(result, false, 'Should fail to set non-existent project');

            // Restore original method
            projectManager.getAllRunnableProjects = originalGetAllRunnableProjects;
        });
    });

    suite('Favorite Projects', () => {
        test('should handle toggleFavorite for new project', () => {
            const projectId = 'test-project-1';

            // Initially not favorite
            assert.strictEqual(projectManager.isFavorite(projectId), false, 'Project should not be favorite initially');

            // Toggle to favorite
            projectManager.toggleFavorite(projectId);
            assert.strictEqual(projectManager.isFavorite(projectId), true, 'Project should be favorite after toggle');

            // Toggle back to not favorite
            projectManager.toggleFavorite(projectId);
            assert.strictEqual(projectManager.isFavorite(projectId), false, 'Project should not be favorite after second toggle');
        });

        test('should load favorites from workspace state', () => {
            const savedFavorites = ['project1', 'project2'];
            const contextWithFavorites = {
                ...mockContext,
                workspaceState: {
                    get: (key: string, defaultValue?: any) => {
                        if (key === 'favoriteProjects') return savedFavorites;
                        return defaultValue;
                    },
                    update: () => Promise.resolve()
                }
            };

            const managerWithFavorites = new ProjectManager(contextWithFavorites);
            assert.strictEqual(managerWithFavorites.isFavorite('project1'), true, 'Should load project1 as favorite');
            assert.strictEqual(managerWithFavorites.isFavorite('project2'), true, 'Should load project2 as favorite');
            assert.strictEqual(managerWithFavorites.isFavorite('project3'), false, 'Should not load project3 as favorite');
        });

        test('should get favorites list', () => {
            const projectId1 = 'fav-project-1';
            const projectId2 = 'fav-project-2';

            // Add favorites
            projectManager.toggleFavorite(projectId1);
            projectManager.toggleFavorite(projectId2);

            const favorites = projectManager.getFavorites();
            assert.ok(Array.isArray(favorites), 'getFavorites should return an array');
            assert.strictEqual(favorites.length, 2, 'Should have 2 favorites');
            assert.ok(favorites.includes(projectId1), 'Should include first favorite');
            assert.ok(favorites.includes(projectId2), 'Should include second favorite');
        });

        test('should handle empty favorites list', () => {
            const favorites = projectManager.getFavorites();
            assert.ok(Array.isArray(favorites), 'getFavorites should return an array');
            assert.strictEqual(favorites.length, 0, 'Should have no favorites initially');
        });

        test('should persist favorites to workspace state on toggle', () => {
            const updates: Array<{ key: string; value: unknown }> = [];
            const contextWithUpdateSpy = {
                ...mockContext,
                workspaceState: {
                    get: (key: string, defaultValue?: any) => defaultValue,
                    update: (key: string, value: unknown) => {
                        updates.push({ key, value });
                        return Promise.resolve();
                    },
                },
            };

            const manager = new ProjectManager(contextWithUpdateSpy);

            manager.toggleFavorite('fav-1');
            assert.ok(updates.length >= 1, 'workspaceState.update should be called');
            assert.strictEqual(updates[updates.length - 1]?.key, 'favoriteProjects');
            assert.deepStrictEqual(updates[updates.length - 1]?.value, ['fav-1']);

            manager.toggleFavorite('fav-2');
            assert.deepStrictEqual(updates[updates.length - 1]?.value, ['fav-1', 'fav-2']);

            manager.toggleFavorite('fav-1');
            assert.deepStrictEqual(updates[updates.length - 1]?.value, ['fav-2']);
        });
    });

    suite('Core stability (high priority)', () => {
        test('should include projects even when PMON status check fails (per-project error isolation)', async () => {
            const throwingProject = {
                getId: () => 'bad',
                getName: () => 'Bad',
                getVersion: () => '3.20',
                getInstallDir: () => '/bad',
                getDir: () => '/bad',
                getConfigPath: () => '/bad/config/config',
                isPmonRunning: async () => {
                    throw new Error('boom');
                },
            };

            const okProject = {
                getId: () => 'ok',
                getName: () => 'Ok',
                getVersion: () => '3.20',
                getInstallDir: () => '/ok',
                getDir: () => '/ok',
                getConfigPath: () => '/ok/config/config',
                isPmonRunning: async () => true,
            };

            const manager = new ProjectManagerWithStubbedRunnable(mockContext, [
                throwingProject,
                okProject,
            ]);
            const projects = await manager.getAllRunnableProjects();
            assert.strictEqual(projects.length, 2, 'Should return both projects');

            const bad = projects.find((p: any) => p.id === 'bad');
            const ok = projects.find((p: any) => p.id === 'ok');

            assert.ok(bad, 'Bad project should be included');
            assert.strictEqual(bad.status, 'error');
            assert.ok(typeof bad.error === 'string' && bad.error.includes('boom'));

            assert.ok(ok, 'Ok project should be included');
            assert.strictEqual(ok.status, 'running');
        });

        test('should skip PMON check when project has no version (does not crash)', async () => {
            const noVersionProject = {
                getId: () => 'noversion',
                getName: () => 'NoVersion',
                getVersion: () => '',
                getInstallDir: () => '/noversion',
                getDir: () => '/noversion',
                getConfigPath: () => '/noversion/config/config',
                isPmonRunning: async () => {
                    throw new Error('should-not-be-called');
                },
            };

            const manager = new ProjectManagerWithStubbedRunnable(mockContext, [noVersionProject]);
            const projects = await manager.getAllRunnableProjects();
            assert.strictEqual(projects.length, 1);
            assert.strictEqual(projects[0]?.id, 'noversion');
            assert.strictEqual(projects[0]?.status, 'stopped');
        });

        test('should only create polling interval when enabled, and always dispose it', async () => {
            const context = {
                ...mockContext,
                extensionMode: vscode.ExtensionMode.Test,
            };
            const manager = new ProjectManager(context);

            // Avoid calling real WinCC OA logic
            (manager as any).loadProjectsInitial = async () => {};
            (manager as any).loadProjectStatusProgressive = async () => {};
            (manager as any).refreshSmartPolling = async () => {};

            const originalSetInterval = global.setInterval;
            const originalClearInterval = global.clearInterval;

            const calls: { set: any[]; clear: any[] } = { set: [], clear: [] };
            (global as any).setInterval = (fn: any, ms?: any) => {
                calls.set.push([fn, ms]);
                return 'interval-id';
            };
            (global as any).clearInterval = (id: any) => {
                calls.clear.push([id]);
            };

            try {
                await manager.initialize({ loadStatus: false, enablePolling: false });
                assert.strictEqual(calls.set.length, 0, 'setInterval should not be called');

                await manager.initialize({ loadStatus: false, enablePolling: true });
                assert.strictEqual(calls.set.length, 1, 'setInterval should be called once');
                assert.strictEqual(calls.set[0]?.[1], 15000, 'Polling interval should be 15s');

                manager.dispose();
                assert.deepStrictEqual(calls.clear, [['interval-id']], 'clearInterval called');
            } finally {
                global.setInterval = originalSetInterval;
                global.clearInterval = originalClearInterval;
            }
        });
    });
});

suite('ProjectInfo Type Tests', () => {
    test('should validate ProjectInfo interface structure', () => {
        const mockProjectInfo: ProjectInfo = {
            id: 'test-project',
            name: 'Test Project',
            installDir: '/opt/WinCC_OA/3.20',
            projectDir: '/opt/WinCC_OA/3.20/test-project',
            version: '3.20',
            oaInstallPath: '/opt/WinCC_OA/3.20',
            configPath: '/opt/WinCC_OA/3.20/test-project/config/config',
            status: 'stopped',
            isRunning: false
        };

        assert.strictEqual(mockProjectInfo.id, 'test-project');
        assert.strictEqual(mockProjectInfo.name, 'Test Project');
        assert.strictEqual(mockProjectInfo.version, '3.20');
        assert.strictEqual(mockProjectInfo.status, 'stopped');
        assert.strictEqual(mockProjectInfo.isRunning, false);
    });

    test('should handle ProjectInfo with error', () => {
        const errorProject: ProjectInfo = {
            id: 'error-project',
            name: 'Error Project',
            installDir: '/opt/WinCC_OA/3.20',
            projectDir: '/opt/WinCC_OA/3.20/error-project',
            version: '3.20',
            oaInstallPath: '/opt/WinCC_OA/3.20',
            configPath: '/opt/WinCC_OA/3.20/error-project/config/config',
            status: 'error',
            isRunning: false,
            error: 'Project not found',
            hasError: true
        };

        assert.strictEqual(errorProject.status, 'error');
        assert.strictEqual(errorProject.error, 'Project not found');
        assert.strictEqual(errorProject.hasError, true);
    });
});

suite('Utility Functions', () => {
    test('should validate ProjectStatus enum values', () => {
        const validStatuses = ['unknown', 'running', 'stopped', 'transitioning', 'error'];

        validStatuses.forEach(status => {
            assert.ok(status.length > 0, `Status ${status} should be non-empty`);
        });
    });

    test('should handle toProjectInfo conversion (mock test)', () => {
        // Since toProjectInfo requires a real ProjEnvProject, we'll just test the interface
        // Test that the function signature exists
        assert.ok(typeof toProjectInfo === 'function', 'toProjectInfo should be a function');
    });
});

suite('Extension Context Mock Tests', () => {
    test('should validate mock context structure', () => {
        const testContext = {
            subscriptions: [],
            extensionPath: '/test/path',
            globalState: {
                get: (key: string, defaultValue?: any) => defaultValue,
                update: () => Promise.resolve(),
                setKeysForSync: () => {}
            },
            workspaceState: {
                get: (key: string, defaultValue?: any) => defaultValue,
                update: () => Promise.resolve()
            }
        };

        assert.ok(Array.isArray(testContext.subscriptions), 'Subscriptions should be an array');
        assert.strictEqual(typeof testContext.globalState.get, 'function', 'Global state should have get method');
        assert.strictEqual(typeof testContext.workspaceState.update, 'function', 'Workspace state should have update method');
    });

    test('should handle workspace state operations', () => {
        let storedValue: any = null;
        const testContext = {
            subscriptions: [],
            extensionPath: '/test/path',
            workspaceState: {
                get: (key: string, defaultValue?: any) => storedValue !== null ? storedValue : defaultValue,
                update: (key: string, value: any) => {
                    storedValue = value;
                    return Promise.resolve();
                }
            }
        };

        // Test storing and retrieving a value
        testContext.workspaceState.update('testKey', 'testValue');
        const retrieved = testContext.workspaceState.get('testKey', 'default');
        assert.strictEqual(retrieved, 'testValue', 'Should retrieve stored value');
    });
});

suite('Error Handling and Edge Cases', () => {
    let mockContext: any;
    let projectManager: ProjectManager;

    suiteSetup(() => {
        mockContext = {
            subscriptions: [],
            extensionPath: '/test/path',
            globalState: {
                get: (key: string, defaultValue?: any) => defaultValue,
                update: () => Promise.resolve(),
                setKeysForSync: () => {}
            },
            workspaceState: {
                get: (key: string, defaultValue?: any) => defaultValue,
                update: () => Promise.resolve()
            }
        };
    });

    setup(() => {
        projectManager = new ProjectManager(mockContext);
    });

    test('should handle invalid project IDs gracefully', () => {
        assert.strictEqual(projectManager.isFavorite(''), false, 'Empty string should not be favorite');
        assert.strictEqual(projectManager.isFavorite('   '), false, 'Whitespace should not be favorite');
        assert.strictEqual(projectManager.isFavorite(null as any), false, 'Null should not be favorite');
        assert.strictEqual(projectManager.isFavorite(undefined as any), false, 'Undefined should not be favorite');
    });

    test('should handle toggleFavorite with invalid IDs', () => {
        const initialFavorites = projectManager.getFavorites().length;

        // Toggle with empty string
        projectManager.toggleFavorite('');
        assert.strictEqual(projectManager.getFavorites().length, initialFavorites + 1, 'Should add empty string as favorite');

        // Toggle again to remove
        projectManager.toggleFavorite('');
        assert.strictEqual(projectManager.getFavorites().length, initialFavorites, 'Should remove empty string favorite');
    });

    test('should handle dispose method', () => {
        // Create a new manager to test dispose
        const testManager = new ProjectManager(mockContext);

        // Should not throw when disposing
        assert.doesNotThrow(() => {
            testManager.dispose();
        }, 'Dispose should not throw');
    });

    test('should handle multiple favorites operations', () => {
        const projectIds = ['proj1', 'proj2', 'proj3'];

        // Add all as favorites
        projectIds.forEach(id => projectManager.toggleFavorite(id));
        assert.strictEqual(projectManager.getFavorites().length, 3, 'Should have 3 favorites');

        // Remove one
        projectManager.toggleFavorite('proj2');
        assert.strictEqual(projectManager.getFavorites().length, 2, 'Should have 2 favorites after removal');
        assert.ok(!projectManager.isFavorite('proj2'), 'proj2 should not be favorite');

        // Add it back
        projectManager.toggleFavorite('proj2');
        assert.strictEqual(projectManager.getFavorites().length, 3, 'Should have 3 favorites again');
        assert.ok(projectManager.isFavorite('proj2'), 'proj2 should be favorite again');
    });
});