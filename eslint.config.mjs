import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
    // Base ESLint recommended rules
    js.configs.recommended,

    // TypeScript files
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: ['./tsconfig.json'],
                sourceType: 'module',
                ecmaVersion: 2021,
            },
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            'no-undef': 'off', // TypeScript handles this, and NodeJS is a TypeScript type
        },
    },

    // Legacy tests: allow patterns common in test setup
    {
        files: ['src/test/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.mocha,
            },
        },
        rules: {
            'no-unassigned-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },

    // JavaScript scripts in scripts/ directory
    {
        files: ['scripts/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-undef': 'off', // Node.js globals are defined
        },
    },

    // Ignore typical output folders
    {
        ignores: ['node_modules/', 'dist/', 'out/', 'coverage/', 'scripts/run-node-tests.ts'],
    },
];