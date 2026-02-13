# Scripts Directory

This directory contains utility scripts for testing and development of the WinCC OA Project Admin extension.

## Available Scripts

### test-add-manager.ts

**Purpose:** Test adding a new manager to a WinCC OA project using the npm-winccoa-core API.

**Description:**
This script validates the `PmonComponent.insertManagerAt()` functionality and demonstrates the proper way to add managers programmatically. It was created to test the fix for the `resetMin` parameter requirement (v2.0.4).

**Usage:**
```bash
npm run test:add-manager
```

**Configuration:**
Edit the `CONFIG` object in the script to customize:
- `projectName` - WinCC OA project name
- `projectPath` - Absolute path to project directory
- `winccOAVersion` - WinCC OA version (e.g., '3.21')
- `newManager` - Manager configuration to add

**What it tests:**
1. ✅ PMON component creation and version setting
2. ✅ Getting manager list before insertion
3. ✅ Checking for duplicate managers
4. ✅ Inserting manager at specified position
5. ✅ Validating manager appears in list after insertion
6. ✅ Verifying manager properties (startMode, resetMin, etc.)

**Example Output:**
```
🧪 WinCC OA Manager Add Test
================================================================================
Project: NewMCPTest
Path: C:\WinCCOA_Proj\NewMCPTest
Version: 3.21
================================================================================

[1/6] Creating PMON component...
   ✅ PMON component created

[2/6] Getting manager list BEFORE insertion...
📋 MANAGERS BEFORE
================================================================================
Total managers: 5

[ 0] DIST_1               | mode: always | -num 0
[ 1] EVENT_1              | mode: always | -num 1
...

✅ TEST PASSED - Manager added successfully!
```

**Next Steps (Migration to Extension):**
The methods and patterns in this script can be migrated to:
- `src/views/managerTreeProvider.ts::addManager()` - Already uses similar approach
- Future API endpoints for programmatic manager addition
- Test suites for integration testing

**Important Notes:**
- The script adds a `TEST_1` manager by default (manual start mode)
- **Remember to remove the test manager** from `config/progs` after testing
- Exit code 0 = success, non-zero = failure
- Validates the critical `resetMin: 0` fix from v2.0.4

---

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
5. Use consistent logging format (see `test-add-manager.ts` for example)

## Dependencies

TypeScript scripts require:
- `ts-node` (devDependency)
- `@winccoa-tools-pack/npm-winccoa-core` (dependency)
- TypeScript configured via root `tsconfig.json`
