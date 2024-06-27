const path = require('path');

module.exports = {
    env: {
        jest: true,
    },
    extends: ['@react-native'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'jest'],
    rules: {
        'react/jsx-indent': [2, 4],
        'react/jsx-indent-props': [2, 4],
        'react/sort-comp': [
            2,
            {
                order: ['static-variables', 'static-methods', 'instance-variables', 'constructor', 'lifecycle', 'everything-else', 'render'],
            },
        ],
        'indent': [2, 4, {
            SwitchCase: 1,
        }],
        'max-len': [2, {
            code: 160,
        }],
        'prettier/prettier': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/interface-name-prefix': 0,
        '@typescript-eslint/no-empty-interface': 0,
        'consistent-return': 'off',
        'prefer-destructuring': 'off',
        // "prettier/prettier": ["warn", {
        //     "singleQuote": true,
        //     "parser": "typescript"
        // }],
        'import/prefer-default-export': 'off',
        'semi': 'error',
        'comma-dangle': 'error',
        'no-trailing-spaces': 'error',
    },
    settings: {
        'import/external-module-folders': ['../node_modules', '../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
        'import/resolver': {
            // NOTE: These aliases must match aliases in metro.config.js
            alias: {
                map: [
                    ['shared/*', path.join(__dirname, '../node_modules')],
                    ['therr-react/*', path.join(__dirname, '../therr-public-library/therr-react/lib')],
                    ['therr-styles/*', path.join(__dirname, '../therr-public-library/therr-styles/lib')],
                    ['therr-js-utilities/*', path.join(__dirname, '../therr-public-library/therr-js-utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.ts', '.json', '.scss'],
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
