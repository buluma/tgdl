// Flat-config (ESLint 9). Keeps rules pragmatic — the project predates a
// linter, so we'd rather fix real bugs than chase style.

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.es2024 },
        },
        rules: {
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrors: 'none',
            }],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-constant-condition': ['warn', { checkLoops: false }],
            'no-prototype-builtins': 'off',
            // sanitizeName matches ASCII control chars on purpose; the
            // \x00-\x1f range is the whole point of the regex.
            'no-control-regex': 'off',
            'no-self-assign': 'warn',
            'no-useless-escape': 'warn',
        },
    },
    {
        files: ['src/web/public/**/*.js'],
        languageOptions: {
            globals: { ...globals.browser },
        },
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2024,
                sourceType: 'module',
            },
            globals: { ...globals.node, ...globals.es2024 },
        },
        plugins: { '@typescript-eslint': tsPlugin },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            // Post-migration: 262 `any` usages remain from the JS era.
            // Turn off the lint noise; tighten via tsconfig `strict` flags
            // incrementally as each module gets proper types.
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrors: 'none',
                destructuredArrayIgnorePattern: '^_',
                ignoreRestSiblings: true,
            }],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            '@typescript-eslint/ban-ts-comment': 'off',
            'no-control-regex': 'off',
        },
    },
    {
        ignores: [
            'node_modules/**',
            'data/**',
            'docs/**',
            'dist/**',
            '*.min.js',
        ],
    },
];
