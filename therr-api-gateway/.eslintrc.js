const path = require('path');
const baseConfig = require('../eslint-config/base');

// API Gateway uses the base config with Node/service settings.
// It sits one level up from services, so paths differ slightly.
module.exports = {
    ...baseConfig,
    env: {
        node: true,
        mocha: true,
    },
    // The gateway builds from base.js rather than createServiceConfig (its path depths
    // differ), which had left it as the one backend package exempt from the brand-scoped
    // table rule. It proxies rather than querying today, so this is defence in depth
    // against the first direct query someone adds here.
    plugins: [
        ...(baseConfig.plugins || []),
        'therr',
    ],
    rules: {
        ...baseConfig.rules,
        'therr/no-direct-brand-scoped-table': 'error',
        'import/extensions': [
            'error',
            'always',
            {
                js: 'never',
                ts: 'never',
                'd.ts': 'never',
            },
        ],
        'import/no-extraneous-dependencies': [
            'warn',
            {
                packageDir: [
                    path.join(__dirname, './'),
                    path.join(__dirname, '../'),
                ],
            },
        ],
    },
    overrides: [
        {
            files: ['tests/**/*.ts', 'tests/**/*.tsx'],
            rules: {
                'no-unused-expressions': 'off',
                '@typescript-eslint/no-unused-expressions': 'off',
                '@typescript-eslint/no-empty-function': 'off',
            },
        },
    ],
    settings: {
        'import/external-module-folders': ['../node_modules', '../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts'],
        },
        'import/resolver': {
            alias: {
                map: [
                    ['therr-public-library/therr-styles/*', path.join(__dirname, '../therr-public-library/therr-styles')],
                    ['therr-js-utilities/*', path.join(__dirname, '../therr-public-library/therr-js-utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.json', '.scss'],
            },
            node: {
                extensions: ['.js', '.ts'],
            },
        },
    },
};
