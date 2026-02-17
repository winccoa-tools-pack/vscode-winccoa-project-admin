import * as assert from 'assert';
import { toProjectInfo, ProjectInfo, ProjectStatus } from '../../types';

suite('Types Unit Tests', () => {
    suite('toProjectInfo Function', () => {
        test('should convert ProjEnvProject to ProjectInfo with running status', () => {
            const mockProject = {
                getId: () => 'test-project',
                getName: () => 'Test Project',
                getVersion: () => '3.20',
                getInstallDir: () => '/opt/WinCC_OA/3.20',
                getDir: () => '/opt/WinCC_OA/3.20/test-project',
                getConfigPath: () => '/opt/WinCC_OA/3.20/test-project/config/config',
            };

            const result = toProjectInfo(mockProject as any, 'running');

            assert.strictEqual(result.id, 'test-project');
            assert.strictEqual(result.name, 'Test Project');
            assert.strictEqual(result.version, '3.20');
            assert.strictEqual(result.status, 'running');
            assert.strictEqual(result.isRunning, true);
            assert.strictEqual(result.hasError, false);
            assert.strictEqual(result.error, undefined);
        });

        test('should convert ProjEnvProject to ProjectInfo with stopped status', () => {
            const mockProject = {
                getId: () => 'stopped-project',
                getName: () => 'Stopped Project',
                getVersion: () => '3.19',
                getInstallDir: () => '/opt/WinCC_OA/3.19',
                getDir: () => '/opt/WinCC_OA/3.19/stopped-project',
                getConfigPath: () => '/opt/WinCC_OA/3.19/stopped-project/config/config',
            };

            const result = toProjectInfo(mockProject as any, 'stopped');

            assert.strictEqual(result.status, 'stopped');
            assert.strictEqual(result.isRunning, false);
            assert.strictEqual(result.hasError, false);
        });

        test('should convert ProjEnvProject to ProjectInfo with error status', () => {
            const mockProject = {
                getId: () => 'error-project',
                getName: () => 'Error Project',
                getVersion: () => '3.18',
                getInstallDir: () => '/opt/WinCC_OA/3.18',
                getDir: () => '/opt/WinCC_OA/3.18/error-project',
                getConfigPath: () => '/opt/WinCC_OA/3.18/error-project/config/config',
            };

            const errorMessage = 'Version not found';
            const result = toProjectInfo(mockProject as any, 'error', errorMessage);

            assert.strictEqual(result.status, 'error');
            assert.strictEqual(result.isRunning, false);
            assert.strictEqual(result.hasError, true);
            assert.strictEqual(result.error, errorMessage);
        });

        test('should handle project with unknown version', () => {
            const mockProject = {
                getId: () => 'unknown-version-project',
                getName: () => 'Unknown Version Project',
                getVersion: () => null,
                getInstallDir: () => '/some/path',
                getDir: () => '/some/path/unknown-version-project',
                getConfigPath: () => '/some/path/unknown-version-project/config/config',
            };

            const result = toProjectInfo(mockProject as any, 'unknown');

            assert.strictEqual(result.version, 'unknown');
            assert.strictEqual(result.oaInstallPath, '');
            assert.strictEqual(result.status, 'unknown');
        });

        test('should handle project with null name (fallback to id)', () => {
            const mockProject = {
                getId: () => 'project-id',
                getName: () => null,
                getVersion: () => '3.20',
                getInstallDir: () => '/opt/WinCC_OA/3.20',
                getDir: () => '/opt/WinCC_OA/3.20/project-id',
                getConfigPath: () => '/opt/WinCC_OA/3.20/project-id/config/config',
            };

            const result = toProjectInfo(mockProject as any, 'stopped');

            assert.strictEqual(
                result.name,
                'project-id',
                'Should fallback to id when name is null',
            );
        });

        test('should handle project with empty name (fallback to id)', () => {
            const mockProject = {
                getId: () => 'project-id',
                getName: () => '',
                getVersion: () => '3.20',
                getInstallDir: () => '/opt/WinCC_OA/3.20',
                getDir: () => '/opt/WinCC_OA/3.20/project-id',
                getConfigPath: () => '/opt/WinCC_OA/3.20/project-id/config/config',
            };

            const result = toProjectInfo(mockProject as any, 'stopped');

            assert.strictEqual(
                result.name,
                'project-id',
                'Should fallback to id when name is empty',
            );
        });

        test('should handle project with null installDir', () => {
            const mockProject = {
                getId: () => 'test-project',
                getName: () => 'Test Project',
                getVersion: () => '3.20',
                getInstallDir: () => null,
                getDir: () => '/opt/WinCC_OA/3.20/test-project',
                getConfigPath: () => '/opt/WinCC_OA/3.20/test-project/config/config',
            };

            const result = toProjectInfo(mockProject as any, 'running');

            assert.strictEqual(result.installDir, '', 'Should handle null installDir');
        });

        test('should default to unknown status when not provided', () => {
            const mockProject = {
                getId: () => 'test-project',
                getName: () => 'Test Project',
                getVersion: () => '3.20',
                getInstallDir: () => '/opt/WinCC_OA/3.20',
                getDir: () => '/opt/WinCC_OA/3.20/test-project',
                getConfigPath: () => '/opt/WinCC_OA/3.20/test-project/config/config',
            };

            const result = toProjectInfo(mockProject as any);

            assert.strictEqual(result.status, 'unknown');
            assert.strictEqual(result.isRunning, false);
            assert.strictEqual(result.hasError, false);
        });
    });

    suite('ProjectStatus Type Validation', () => {
        test('should validate all ProjectStatus values', () => {
            const validStatuses: ProjectStatus[] = [
                'unknown',
                'running',
                'stopped',
                'transitioning',
                'error',
            ];

            validStatuses.forEach((status) => {
                assert.ok(typeof status === 'string', `Status ${status} should be a string`);
                assert.ok(status.length > 0, `Status ${status} should not be empty`);
            });
        });

        test('should handle ProjectInfo interface compliance', () => {
            const testProject: ProjectInfo = {
                id: 'test',
                name: 'Test',
                installDir: '/install',
                projectDir: '/project',
                version: '3.20',
                oaInstallPath: '/oa',
                configPath: '/config',
                status: 'running',
                isRunning: true,
            };

            // Test all required properties exist
            assert.ok(testProject.id);
            assert.ok(testProject.name);
            assert.ok(testProject.installDir);
            assert.ok(testProject.projectDir);
            assert.ok(testProject.version);
            assert.ok(testProject.oaInstallPath);
            assert.ok(testProject.configPath);
            assert.ok(testProject.status);
            assert.ok(typeof testProject.isRunning === 'boolean');
        });

        test('should handle ProjectInfo with optional error properties', () => {
            const errorProject: ProjectInfo = {
                id: 'error-test',
                name: 'Error Test',
                installDir: '/install',
                projectDir: '/project',
                version: '3.20',
                oaInstallPath: '/oa',
                configPath: '/config',
                status: 'error',
                isRunning: false,
                error: 'Test error',
                hasError: true,
            };

            assert.strictEqual(errorProject.error, 'Test error');
            assert.strictEqual(errorProject.hasError, true);
        });
    });

    suite('Type Safety and Edge Cases', () => {
        test('should ensure ProjectInfo type safety', () => {
            // This test ensures the interface is properly typed
            const project: ProjectInfo = {
                id: 'test',
                name: 'Test',
                installDir: '/test',
                projectDir: '/test/project',
                version: '3.20',
                oaInstallPath: '/opt/WinCC_OA/3.20',
                configPath: '/test/project/config/config',
                status: 'running',
                isRunning: true,
            };

            // TypeScript should catch any missing required properties
            assert.ok(project);
        });

        test('should handle all ProjectStatus enum values in conversion', () => {
            const mockProject = {
                getId: () => 'test-project',
                getName: () => 'Test Project',
                getVersion: () => '3.20',
                getInstallDir: () => '/opt/WinCC_OA/3.20',
                getDir: () => '/opt/WinCC_OA/3.20/test-project',
                getConfigPath: () => '/opt/WinCC_OA/3.20/test-project/config/config',
            };

            const statuses: ProjectStatus[] = [
                'unknown',
                'running',
                'stopped',
                'transitioning',
                'error',
            ];

            statuses.forEach((status) => {
                const result = toProjectInfo(mockProject as any, status);
                assert.strictEqual(result.status, status);
                assert.strictEqual(result.isRunning, status === 'running');
                assert.strictEqual(result.hasError, status === 'error');
            });
        });
    });
});
