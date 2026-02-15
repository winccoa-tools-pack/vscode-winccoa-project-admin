import * as assert from 'assert';
import * as vscode from 'vscode';
import { SystemItem, SystemTreeProvider } from '../../views/systemTreeProvider';

suite('SystemTreeProvider Unit Tests', () => {
    test('should sort projects: favorites first, then by name', async () => {
        const projects = [
            {
                id: 'b',
                name: 'Beta',
                status: 'stopped',
                isRunning: false,
                projectDir: '/b',
            },
            {
                id: 'a',
                name: 'Alpha',
                status: 'running',
                isRunning: true,
                projectDir: '/a',
            },
            {
                id: 'c',
                name: 'Charlie',
                status: 'unknown',
                isRunning: false,
                projectDir: '/c',
            },
        ];

        const mockProjectManager: any = {
            getRunningProjects: () => projects,
            isFavorite: (id: string) => id === 'c',
            getCurrentProject: () => undefined,
            // Minimal Event<T> implementation
            onDidChangeProject: () => ({ dispose: () => {} }),
            onDidChangeProjects: () => ({ dispose: () => {} }),
            getAllRunnableProjects: async () => projects,
        };

        const provider = new SystemTreeProvider(mockProjectManager);
        const projectsElement = new SystemItem(
            'Projects',
            vscode.TreeItemCollapsibleState.Collapsed,
            'projects',
        );

        const children = await provider.getChildren(projectsElement);
        const labels = children.map((c) => c.label);

        // Favorite 'Charlie' should come first, then Alpha, then Beta (alphabetical within group)
        assert.deepStrictEqual(labels, ['Charlie', 'Alpha', 'Beta']);

        assert.strictEqual(children[0]?.contextValue, 'project-favorite');
        assert.strictEqual(children[1]?.contextValue, 'project-nonfavorite');
    });
});
