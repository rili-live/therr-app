const path = require('path');

// .eslintrc.js
module.exports = {
    env: {
        browser: true,
        jest: true
    },
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
        "plugin:react/recommended"
    ],
    plugins: [
        '@typescript-eslint'
    ],
    parser: '@typescript-eslint/parser',
    rules: {
        'react/jsx-indent': [2, 4],
        'react/jsx-indent-props': [2, 4],
        'react/sort-comp': [
            2,
            {
                order: [ 'static-methods', 'lifecycle', 'everything-else', 'render' ]
            }
        ],
        'indent': [2, 4, { SwitchCase: 1 }],
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
                'js': 'never',
                'jsx': 'always',
                'ts': 'never',
                'tsx': 'never',
                'd.ts': 'never',
            }
        ],
    },
    settings: {
        'import/external-module-folders': ['../../node_modules', '../../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx']
        },
        'import/resolver': {
            // NOTE: These aliases must match aliases in webpack.config.js
            alias: {
                map: [
                    ['rili-public-library/styles/*', path.join(__dirname, '../styles')],
                    ['rili-utilities/*', path.join(__dirname, '../utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.json', '.scss'],
            },
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx']
            }
        },
        react: {
            version: "detect",
        }
    }
};