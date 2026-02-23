import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(projectRoot, 'src', 'test', 'fixtures');
const destDir = path.join(projectRoot, 'out', 'test', 'fixtures');

if (!fs.existsSync(srcDir)) {
  console.error(`Missing fixtures source directory: ${srcDir}`);
  process.exit(1);
}

fs.rmSync(destDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
fs.mkdirSync(path.dirname(destDir), { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true });

console.log(`Copied fixtures: ${srcDir} -> ${destDir}`);
