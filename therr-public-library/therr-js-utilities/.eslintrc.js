const path = require('path');
const baseConfig = require('../../eslint-config/base');

// therr-js-utilities: isomorphic library, both browser and Node.
module.exports = {
    ...baseConfig,
    env: {
        browser: true,
        jest: true,
        mocha: true,
    },
    rules: {
        ...baseConfig.rules,
        'import/extensions': [
            'error',
            'always',
            {
                js: 'always',
                ts: 'never',
                'd.ts': 'never',
            },
        ],
        'import/no-extraneous-dependencies': [
            'warn',
            {
                packageDir: [
                    path.join(__dirname, './'),
                    path.join(__dirname, '../..'),
                ],
            },
        ],
    },
    settings: {
        'import/external-module-folders': ['../node_modules', '../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts'],
        },
        'import/resolver': {
            node: {
                extensions: ['.js', '.ts'],
            },
        },
    },
};
