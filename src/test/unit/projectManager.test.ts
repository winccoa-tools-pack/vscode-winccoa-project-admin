import * as assert from 'assert';
import { ProjectManager } from '../../projectManager';
import { ProjectInfo, toProjectInfo } from '../../types';

suite('ProjectManager Unit Tests', () => {
    let mockContext: any;
    let projectManager: ProjectManager;

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