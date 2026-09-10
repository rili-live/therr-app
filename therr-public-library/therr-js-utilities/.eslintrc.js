const path = require('path');
const baseConfig = require('../../eslint-config/base');
const { SHARED_LIBRARY_MODULES, SHARED_LIBRARY_INTERNAL_REGEX } = require('../../eslint-config/shared-library-modules');

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
        'import/core-modules': SHARED_LIBRARY_MODULES,
        'import/internal-regex': SHARED_LIBRARY_INTERNAL_REGEX,
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
