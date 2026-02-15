/* eslint-env node */
/* global process, console */
import fs from 'fs';
import path from 'path';

function readJsonSummary(label) {
    const summaryPath = path.resolve('coverage', label, 'coverage-summary.json');
    if (!fs.existsSync(summaryPath)) return null;
    return { label, data: JSON.parse(fs.readFileSync(summaryPath, 'utf8')) };
}

function pct(value) {
    return typeof value === 'number' ? `${value.toFixed(2)}%` : 'n/a';
}

const labels = process.argv.slice(2);
if (labels.length === 0) {
    console.error('Usage: node scripts/write-coverage-summary.mjs <label> [label2 ...]');
    process.exit(2);
}

const summaries = labels
    .map(readJsonSummary)
    .filter(Boolean);

if (summaries.length === 0) {
    console.log('No coverage summaries found.');
    process.exit(0);
}

console.log('## Coverage');
console.log('');
console.log('| Suite | Lines | Statements | Functions | Branches |');
console.log('|---|---:|---:|---:|---:|');

for (const { label, data } of summaries) {
    const total = data.total;
    console.log(
        `| ${label} | ${pct(total.lines.pct)} | ${pct(total.statements.pct)} | ${pct(total.functions.pct)} | ${pct(total.branches.pct)} |`,
    );
}

console.log('');
console.log('Artifacts: download HTML report from the workflow run.');
