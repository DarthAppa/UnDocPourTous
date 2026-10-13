// ESLint : erreurs JS réelles (variables inconnues, code mort, bugs courants).
// Le style (espaces, guillemets) est géré par Prettier, pas ici.
import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'node_modules/**',
            'shots/**',
            'docs-prives/**',
            'Claude outputs/**',
            'assets/**',
            'pts-encyclopedie.html',
            'pts-builder.html',
        ],
    },
    js.configs.recommended,
    {
        // Scripts chargés par les pages (navigateur)
        files: ['*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                tailwind: 'writable', // CDN Tailwind
                supabase: 'readonly', // CDN Supabase
            },
        },
        rules: {
            'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
            eqeqeq: ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-eval': 'error',
            'no-implied-eval': 'error',
        },
    },
    {
        // Outils Node (captures, import PTS, tests, hooks)
        files: ['tools/**/*.{js,mjs}', '.claude/hooks/**/*.mjs', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.node },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
            'prefer-const': 'error',
        },
    },
    {
        // Le code passé à page.evaluate() tourne dans le navigateur
        files: ['tools/**/*.{js,mjs}'],
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
    },
];
