# Scripts Directory

This directory contains utility scripts for testing and development of the WinCC OA Project Admin extension.

## Available Scripts

### Add-manager test (moved)

The former manual script `test-add-manager.ts` has been migrated into the VS Code integration test suite.

- Test location: `src/test/integration/vscode-integration.test.ts`
- Test name: `should add manager via PMON insertManagerAt (resetMin regression)`

This keeps the logic versioned, runnable via CI, and automatically cleaned up after each run.

### test-local.js

**Purpose:** Package extension as VSIX and install it locally for manual testing.

**Usage:**

```bash
node scripts/test-local.js
```

---

### wait-for-winccoa.sh

**Purpose:** Shell script for waiting until WinCC OA project is ready.

**Usage:**

```bash
./scripts/wait-for-winccoa.sh <project-name>
```

---

## Adding New Scripts

When adding new helper scripts:

1. Place TypeScript scripts here with `.ts` extension
2. Add corresponding npm script in `package.json`
3. Document the script in this README
4. Ensure scripts are executable with proper error handling
5. Use consistent logging format

## Dependencies

TypeScript scripts require:

- `ts-node` (devDependency)
- `@winccoa-tools-pack/npm-winccoa-core` (dependency)
- TypeScript configured via root `tsconfig.json`
