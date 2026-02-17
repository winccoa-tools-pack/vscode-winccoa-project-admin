/* eslint-env node */
/* global process, console */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function spawnAsync(command, args, options) {
    return new Promise((resolve) => {
        const child = spawn(command, args, options);
        child.on('close', (code) => resolve(code ?? 1));
        child.on('error', () => resolve(1));
    });
}

function npxInvocation(npxArgs) {
    if (process.platform === 'win32') {
        return { command: 'cmd.exe', args: ['/c', 'npx', ...npxArgs] };
    }
    return { command: 'npx', args: npxArgs };
}

const label = process.argv[2];
if (!label) {
    console.error('Usage: node scripts/run-vscode-test-coverage.mjs <label>');
    process.exit(2);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
process.chdir(repoRoot);

const reportDir = path.resolve(repoRoot, 'coverage', label);
fs.rmSync(reportDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
fs.mkdirSync(reportDir, { recursive: true });

const args = [
    '--no-install',
    'vscode-test',
    '--label',
    label,
    '--coverage',
    '--coverage-output',
    `coverage/${label}`,
    '--coverage-reporter',
    'lcov',
    '--coverage-reporter',
    'html',
    '--coverage-reporter',
    'json-summary',
    '--coverage-reporter',
    'text-summary',
];

const invocation = npxInvocation(args);
const exitCode = await spawnAsync(invocation.command, invocation.args, { stdio: 'inherit' });
process.exit(exitCode);
