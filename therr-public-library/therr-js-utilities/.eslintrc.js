const path = require('path');

// .eslintrc.js
module.exports = {
    env: {
        browser: true,
        jest: true,
        mocha: true,
    },
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
    ],
    plugins: [
        '@typescript-eslint',
    ],
    parser: '@typescript-eslint/parser',
    ignorePatterns: ["**/.eslintrc.js"],
    rules: {
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
        'no-shadow': 'off',
        '@typescript-eslint/ban-types': 'off',
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
