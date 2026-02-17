#!/usr/bin/env node
/**
 * Setup script for full VS Code integration tests with WinCC OA
 * This script ensures WinCC OA test projects are properly configured
 * before running VS Code integration tests.
 */

const fs = require('fs');
const path = require('path');

// Simple copy function for test fixtures
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('🔧 Setting up WinCC OA test environment for full integration tests...');

try {
    // Check if we're in a CI environment with WinCC OA
    const hasWinCCOA = process.env.WINCCOA_TEST_PROJECTS_READY === 'true';

    if (!hasWinCCOA) {
        console.log('⚠️  WinCC OA test environment not detected');
        console.log('   This is expected in local development without WinCC OA');
        console.log('   Full integration tests will be skipped');
        process.exit(0);
    }

    // Ensure test fixtures are copied to output directory
    const srcFixtures = path.resolve(__dirname, '..', 'test', 'fixtures');
    const outFixtures = path.resolve(__dirname, '..', 'out', 'test', 'fixtures');

    console.log(`📁 Copying test fixtures from ${srcFixtures} to ${outFixtures}`);

    copyDir(srcFixtures, outFixtures);
    console.log('✅ Test fixtures copied successfully');

    // Verify test projects exist
    const runnableConfig = path.join(outFixtures, 'projects', 'runnable', 'config', 'config');
    const subProjConfig = path.join(outFixtures, 'projects', 'sub-proj', 'config', 'config');

    if (!fs.existsSync(runnableConfig)) {
        throw new Error(`Test fixture not found: ${runnableConfig}`);
    }

    if (!fs.existsSync(subProjConfig)) {
        throw new Error(`Test fixture not found: ${subProjConfig}`);
    }

    console.log('✅ WinCC OA test projects verified');
    console.log('🚀 Full integration test environment is ready!');

} catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    process.exit(1);
}