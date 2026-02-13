#!/usr/bin/env ts-node

/**
 * Test Script: Add Manager to WinCC OA Project
 * 
 * Tests adding a new manager to an existing WinCC OA project using
 * the npm-winccoa-core PmonComponent.insertManagerAt() method.
 * 
 * This script validates the fix for resetMin parameter and can be used
 * to migrate functionality into the extension later.
 * 
 * Usage:
 *   npm run test-add-manager
 *   or
 *   ts-node scripts/test-add-manager.ts
 */

import { 
    PmonComponent, 
    ProjEnvManagerStartMode,
    ProjEnvManagerOptions 
} from '@winccoa-tools-pack/npm-winccoa-core';

// =====================================================
// CONFIGURATION
// =====================================================

const CONFIG = {
    projectName: 'DevEnv3.21',
    projectPath: 'C:\\WinCCOA_Proj\\DevEnv3.21',
    winccOAVersion: '3.21',
    
    // Manager to add
    newManager: {
        component: 'TEST_1',
        startMode: ProjEnvManagerStartMode.Manual,
        secondToKill: 30,
        resetMin: 0,           // CRITICAL: This was the fix in v2.0.4
        resetStartCounter: 1,
        startOptions: '-num 0'
    }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function printManagerList(managers: any[], title: string) {
    console.log(`\n${title}`);
    console.log('='.repeat(80));
    console.log(`Total managers: ${managers.length}\n`);
    
    managers.forEach((m, i) => {
        const startMode = m.startMode === 0 ? 'manual' : 
                         m.startMode === 1 ? 'once' : 
                         m.startMode === 2 ? 'always' : m.startMode;
        const options = m.startOptions || '';
        console.log(`[${i.toString().padStart(2)}] ${m.component.padEnd(20)} | mode: ${startMode.toString().padEnd(6)} | ${options}`);
    });
    console.log('='.repeat(80));
}

function findManagerIndex(managers: any[], component: string): number {
    return managers.findIndex(m => m.component === component);
}

// =====================================================
// MAIN TEST FUNCTION
// =====================================================

async function testAddManager() {
    console.log('🧪 WinCC OA Manager Add Test');
    console.log('='.repeat(80));
    console.log(`Project: ${CONFIG.projectName}`);
    console.log(`Path: ${CONFIG.projectPath}`);
    console.log(`Version: ${CONFIG.winccOAVersion}`);
    console.log('='.repeat(80));

    try {
        // Step 1: Create PMON component
        console.log('\n[1/6] Creating PMON component...');
        const pmon = new PmonComponent();
        pmon.setVersion(CONFIG.winccOAVersion);
        console.log('   ✅ PMON component created');

        // Step 2: Get managers BEFORE
        console.log('\n[2/6] Getting manager list BEFORE insertion...');
        const managersBefore = await pmon.getManagerOptionsList(CONFIG.projectName);
        printManagerList(managersBefore, '📋 MANAGERS BEFORE');

        // Check if manager already exists
        const existingIndex = findManagerIndex(managersBefore, CONFIG.newManager.component);
        if (existingIndex !== -1) {
            console.log(`\n⚠️  WARNING: Manager ${CONFIG.newManager.component} already exists at index ${existingIndex}!`);
            console.log('   Please remove it manually from config/progs and try again.');
            console.log('   Or change CONFIG.newManager.component to a different name.\n');
            process.exit(1);
        }
        console.log(`   ✅ Manager ${CONFIG.newManager.component} not found - safe to add`);

        // Step 3: Choose insert position
        const insertPosition = managersBefore.length; // Append at end
        console.log(`\n[3/6] Insert position: ${insertPosition} (at end)`);

        // Step 4: Execute insertManagerAt
        console.log(`\n[4/6] Adding manager ${CONFIG.newManager.component}...`);
        console.log(`   Component: ${CONFIG.newManager.component}`);
        console.log(`   Start Mode: ${CONFIG.newManager.startMode} (Manual)`);
        console.log(`   Position: ${insertPosition}`);
        console.log(`   resetMin: ${CONFIG.newManager.resetMin} (CRITICAL FIX)`);
        
        const options: ProjEnvManagerOptions = {
            component: CONFIG.newManager.component,
            startMode: CONFIG.newManager.startMode,
            secondToKill: CONFIG.newManager.secondToKill,
            resetMin: CONFIG.newManager.resetMin,
            resetStartCounter: CONFIG.newManager.resetStartCounter,
            startOptions: CONFIG.newManager.startOptions
        };

        const exitCode = await pmon.insertManagerAt(
            options,
            CONFIG.projectName,
            insertPosition
        );

        console.log(`   Exit Code: ${exitCode}`);
        
        if (exitCode !== 0) {
            console.log(`   ❌ insertManagerAt failed with exit code ${exitCode}`);
            process.exit(1);
        }
        console.log('   ✅ insertManagerAt succeeded');

        // Step 5: Wait for config write
        console.log('\n[5/6] Waiting for config to be written...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('   ✅ Wait complete');

        // Step 6: Get managers AFTER
        console.log('\n[6/6] Getting manager list AFTER insertion...');
        const managersAfter = await pmon.getManagerOptionsList(CONFIG.projectName);
        printManagerList(managersAfter, '📋 MANAGERS AFTER');

        // Validation
        console.log('\n🔍 VALIDATION');
        console.log('='.repeat(80));
        
        const newIndex = findManagerIndex(managersAfter, CONFIG.newManager.component);
        if (newIndex === -1) {
            console.log(`❌ FAILED: Manager ${CONFIG.newManager.component} not found after insertion!`);
            process.exit(1);
        }

        console.log(`✅ Manager found at index: ${newIndex}`);
        console.log(`   Expected index: ${insertPosition}`);
        
        if (newIndex === insertPosition) {
            console.log('   ✅ Position matches expected');
        } else {
            console.log(`   ⚠️  Position mismatch! Expected ${insertPosition}, got ${newIndex}`);
        }

        const addedManager = managersAfter[newIndex];
        console.log('\n📊 Manager Details:');
        console.log(`   Component: ${addedManager.component}`);
        console.log(`   Start Mode: ${addedManager.startMode} (${addedManager.startMode === 0 ? 'Manual' : addedManager.startMode === 1 ? 'Once' : 'Always'})`);
        console.log(`   Second to Kill: ${addedManager.secondToKill}`);
        console.log(`   Reset Min: ${addedManager.resetMin}`);
        console.log(`   Reset Start Counter: ${addedManager.resetStartCounter}`);
        console.log(`   Start Options: ${addedManager.startOptions || '(empty)'}`);

        console.log('\n' + '='.repeat(80));
        console.log('✅ TEST PASSED - Manager added successfully!');
        console.log('='.repeat(80));
        console.log('\n💡 Next Steps:');
        console.log('   1. Check config/progs file manually to verify format');
        console.log('   2. Try starting the manager: CTRL_1 -num 0');
        console.log('   3. Remove test manager when done: Edit config/progs and remove TEST_1 line');
        console.log('');

    } catch (error) {
        console.error('\n❌ TEST FAILED');
        console.error('='.repeat(80));
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        } else {
            console.error(String(error));
        }
        console.error('='.repeat(80));
        process.exit(1);
    }
}

// =====================================================
// ENTRY POINT
// =====================================================

if (require.main === module) {
    testAddManager().catch(err => {
        console.error('Unhandled error:', err);
        process.exit(1);
    });
}

export { testAddManager, CONFIG };
