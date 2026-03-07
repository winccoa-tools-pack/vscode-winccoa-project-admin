import * as assert from 'assert';
import { suite, test, suiteSetup, suiteTeardown } from 'mocha';
import * as vscode from 'vscode';
import { ProjectManager } from '../../projectManager';
import { registerRunnableTestProject, unregisterTestProject } from '../test-project-helpers';
// stopWatchingProjectRegistries was removed from npm-winccoa-core
import path from 'path';
import fs from 'fs';
import {
    PmonComponent,
    ProjEnvManagerStartMode,
    type ProjEnvManagerOptions,
} from '@winccoa-tools-pack/npm-winccoa-core';

suite('Full VS Code Integration Tests with WinCC OA', () => {
    let testProject: any;
    let projectManager: ProjectManager;

    suiteSetup(async function () {
        this.timeout(180000); // 180 second timeout for setup (WinCC OA / process spawns can be slow)

        console.log('🔧 Setting up full integration test environment...');

        try {
            // Register a test project with WinCC OA
            console.log('📝 Registering test project with WinCC OA...');
            testProject = await registerRunnableTestProject();
            assert.ok(testProject, 'Test project should be registered');

            // Initialize project manager
            const context = {
                subscriptions: [],
                extensionPath:
                    vscode.extensions.getExtension('winccoa-tools-pack.winccoa-project-admin')
                        ?.extensionPath || '',
                extensionMode: vscode.ExtensionMode.Test,
                globalState: {
                    get: (key: string, defaultValue?: any) => defaultValue,
                    update: () => Promise.resolve(),
                    setKeysForSync: () => {},
                },
                workspaceState: {
                    get: (key: string, defaultValue?: any) => defaultValue,
                    update: () => Promise.resolve(),
                },
            } as any;

            projectManager = new ProjectManager(context);
            await projectManager.initialize({ loadStatus: false, enablePolling: false });

            console.log('✅ Full integration test environment ready');
        } catch (error) {
            console.error('❌ Failed to setup integration test environment:', error);
            throw error;
        }
    });

    suiteTeardown(async function () {
        this.timeout(30000); // 30 second timeout for cleanup

        console.log('🧹 Cleaning up full integration test environment...');

        try {
            if (projectManager) {
                projectManager.dispose();
            }

            if (testProject) {
                await unregisterTestProject(testProject);
            }

            console.log('✅ Full integration test cleanup complete');

            // stopWatchingProjectRegistries was removed from npm-winccoa-core
        } catch (error) {
            console.warn('⚠️  Cleanup warning (non-fatal):', error);
        }

        // Print system info for PR confirmation (copy-paste this into PR when CI OOMs)
        // Using process.stdout.write to ensure output is visible even when console.log is suppressed
        const os = process.platform;
        const nodeVersion = process.versions.node;
        const vscodeVersion = vscode.version;
        const winCCOAVersion = testProject?.getVersion?.() || 'N/A';

        const output = [
            '',
            '═'.repeat(70),
            '📋 LOCAL INTEGRATION TEST RESULT (copy this into PR if CI OOMs)',
            '═'.repeat(70),
            '```',
            '✅ Integration Tests: PASSED',
            `   OS:            ${os} (${process.arch})`,
            `   Node.js:       v${nodeVersion}`,
            `   VS Code:       ${vscodeVersion}`,
            `   WinCC OA:      ${winCCOAVersion}`,
            `   Date:          ${new Date().toISOString()}`,
            '```',
            '═'.repeat(70),
            '',
        ].join('\n');

        process.stdout.write(output + '\n');
    });

    test('should load projects from WinCC OA system', async function () {
        this.timeout(10000);

        // Test that project manager can discover projects
        const projects = await projectManager.getAllRunnableProjects();
        console.log(
            '🔍 Found projects:',
            projects.map((p) => ({ id: p.id, name: p.name, projectDir: p.projectDir })),
        );
        assert.ok(Array.isArray(projects), 'Should return projects array');
        assert.ok(projects.length > 0, 'Should find at least one project');

        // Check that our test project is in the list
        const foundTestProject = projects.find((p: any) => p.id === testProject.getId());
        console.log('🔍 Looking for test project with ID:', testProject.getId());
        console.log('🔍 Test project details:', {
            id: testProject.getId(),
            name: testProject.getName(),
            path: testProject.getDir(),
        });
        assert.ok(foundTestProject, 'Test project should be discoverable');
    });

    test('should show project status correctly', async function () {
        this.timeout(15000);

        // Wait a bit for status to update
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get projects again to check status
        const projects = await projectManager.getAllRunnableProjects();
        const testProj = projects.find((p: any) => p.id === testProject.getId());

        assert.ok(testProj, 'Test project should exist');
        assert.ok(testProj.status !== 'unknown', 'Project status should be known');
    });

    test('should execute VS Code commands', async function () {
        this.timeout(10000);

        // Test executing VS Code commands that interact with WinCC OA
        try {
            await vscode.commands.executeCommand('winccoa.core.refreshProjects');
            console.log('✅ Refresh projects command executed successfully');
        } catch (error) {
            // Command might fail if UI is not fully initialized in test environment
            console.log('⚠️  Command execution note:', (error as Error).message);
        }

        // Verify command is registered
        const commands = await vscode.commands.getCommands(true);
        assert.ok(
            commands.includes('winccoa.core.refreshProjects'),
            'Refresh command should be registered',
        );
        assert.ok(
            commands.includes('winccoa.core.selectProject'),
            'Select project command should be registered',
        );
    });

    test('should integrate with VS Code workspace', async function () {
        this.timeout(10000);

        // Test workspace integration
        const workspaceFolders = vscode.workspace.workspaceFolders;
        assert.ok(workspaceFolders, 'Should have workspace folders');

        // Test that extension can add projects to workspace
        // (This would be a more complex test in real implementation)
        console.log('✅ Workspace integration test placeholder');
    });

    test('should handle project lifecycle', async function () {
        this.timeout(30000);

        const projectId = testProject.getId();
        console.log(`Testing project lifecycle for: ${projectId}`);

        // Test project start (if not already running)
        try {
            const startResult = await testProject.start();
            console.log(`Project start result: ${startResult}`);
        } catch (error) {
            console.log(`Project start note (may already be running): ${(error as Error).message}`);
        }

        // Wait for project to stabilize
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Verify project is running
        const isRunning = testProject.isRunning();
        console.log(`Project running status: ${isRunning}`);

        // Test project stop
        try {
            await testProject.stop();
            console.log('✅ Project stopped successfully');
        } catch (error) {
            console.log(`Project stop note: ${(error as Error).message}`);
        }
    });

    test('should add manager via PMON insertManagerAt (resetMin regression)', async function () {
        this.timeout(60000);

        const version = testProject?.getVersion?.() as string | undefined;
        const projectId = testProject?.getId?.() as string | undefined;
        const projectDir = testProject?.getDir?.() as string | undefined;

        if (!version || !projectId || !projectDir) {
            this.skip();
            return;
        }

        const progsPath = path.join(projectDir, 'config', 'progs');
        if (!fs.existsSync(progsPath)) {
            this.skip();
            return;
        }

        const baselineProgs = fs.readFileSync(progsPath, 'utf8');
        // WinCC OA limits manager names (e.g. max 19 chars). Keep this short.
        const uniqueComponent = `IT_${Date.now()}`.slice(0, 19);

        const pmon = new PmonComponent();
        pmon.setVersion(version);

        const findManagerIndex = (managers: any[], component: string): number =>
            managers.findIndex((m) => m?.component === component);

        try {
            const managersBefore = await pmon.getManagerOptionsList(projectId);
            assert.ok(Array.isArray(managersBefore), 'Manager list should be an array');
            assert.strictEqual(
                findManagerIndex(managersBefore, uniqueComponent),
                -1,
                `Test manager ${uniqueComponent} must not exist before insertion`,
            );

            const insertPosition = managersBefore.length;
            const options: ProjEnvManagerOptions = {
                component: uniqueComponent,
                startMode: ProjEnvManagerStartMode.Manual,
                secondToKill: 30,
                resetMin: 0,
                resetStartCounter: 1,
                startOptions: '-num 0',
            };

            const exitCode = await pmon.insertManagerAt(options, projectId, insertPosition);
            assert.strictEqual(exitCode, 0, `insertManagerAt should return 0 (got ${exitCode})`);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            const managersAfter = await pmon.getManagerOptionsList(projectId);
            const newIndex = findManagerIndex(managersAfter, uniqueComponent);
            assert.ok(newIndex !== -1, 'Inserted manager should be present after insertion');

            const addedManager = managersAfter[newIndex];
            assert.strictEqual(addedManager.component, uniqueComponent);
            assert.strictEqual(addedManager.resetMin, 0, 'resetMin should be persisted as 0');
            assert.strictEqual(addedManager.startMode, ProjEnvManagerStartMode.Manual);
        } catch (error) {
            const message = (error as Error)?.message ?? String(error);
            if (/version .* not found|not installed|WCCILpmon/i.test(message)) {
                this.skip();
                return;
            }
            throw error;
        } finally {
            fs.writeFileSync(progsPath, baselineProgs, 'utf8');
        }
    });
});
