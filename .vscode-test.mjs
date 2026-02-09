import { defineConfig } from '@vscode/test-cli';

export default defineConfig([{
	files: 'out/test/**/*.test.js',
	mocha: {
		ui: 'tdd',
	}
},
{
	label: 'unitTests',
	files: 'out/test/unit/**/*.test.js',
	version: 'stable',
	// unit tests usually don’t need a workspace
	mocha: {
		ui: 'tdd',
		timeout: 5000
	}
},
{
	label: 'integrationTests',
	files: 'out/test/integration/**/*.test.js',
	version: 'stable',
	// integration tests usually run with a workspace open
	workspaceFolder: './test-workspace',
	mocha: {
		ui: 'tdd',
		timeout: 20000
	}
}
]
);
