const path = require('path');

// .eslintrc.js
module.exports = {
    env: {
        browser: true,
        jest: true,
    },
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
    ],
    plugins: [
        '@typescript-eslint',
    ],
    parser: '@typescript-eslint/parser',
    ignorePatterns: ["**/.eslintrc.js"],
    rules: {
        'react/jsx-indent': [2, 4],
        'react/jsx-indent-props': [2, 4],
        'react/sort-comp': [
            2,
            {
                order: ['static-variables', 'static-methods', 'instance-variables', 'constructor', 'lifecycle', 'everything-else', 'render'],
            },
        ],
        indent: [2, 4, { SwitchCase: 1 }],
        'max-len': [2, { code: 140 }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/interface-name-prefix': 0,
        'consistent-return': 'off',
        'prefer-destructuring': 'off',
        'import/prefer-default-export': 'off',
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
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': ['error'],
    },
    settings: {
        'import/external-module-folders': ['../../node_modules', '../../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
        'import/resolver': {
            // NOTE: These aliases must match aliases in webpack.config.js
            alias: {
                map: [
                    ['therr-styles/*', path.join(__dirname, '../therr-styles')],
                    ['therr-js-utilities/*', path.join(__dirname, '../therr-js-utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.json', '.scss'],
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
