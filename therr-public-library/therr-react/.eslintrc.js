const path = require('path');
const baseConfig = require('../../eslint-config/base');

// therr-react: shared React library for web and mobile.
module.exports = {
    ...baseConfig,
    env: {
        browser: true,
        jest: true,
    },
    extends: [
        ...baseConfig.extends,
        'plugin:react/recommended',
    ],
    rules: {
        ...baseConfig.rules,
        'react/jsx-indent': [2, 4],
        'react/jsx-indent-props': [2, 4],
        'react/prop-types': 'off',
        'react/display-name': 'off',
        'react/sort-comp': [
            2,
            {
                order: ['static-variables', 'static-methods', 'instance-variables', 'constructor', 'lifecycle', 'everything-else', 'render'],
            },
        ],
        'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['draft', 'acc', 'staticContext'] }],
        'import/extensions': [
            'error',
            'always',
            {
                js: 'never',
                jsx: 'never',
                ts: 'never',
                tsx: 'never',
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
        'import/external-module-folders': ['../../node_modules', '../../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
        'import/resolver': {
            alias: {
                map: [
                    ['therr-styles/*', path.join(__dirname, '../therr-styles')],
                    ['therr-js-utilities/*', path.join(__dirname, '../therr-js-utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.ts', '.d.ts', '.json', '.scss'],
            },
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
            },
        },
        react: {
            version: 'detect',
        },
    },
};
