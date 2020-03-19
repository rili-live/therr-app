const path = require('path');

// .eslintrc.js
module.exports = {
    env: {
        node: true,
        mocha: true
    },
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended'
    ],
    plugins: [
        '@typescript-eslint'
    ],
    parser: '@typescript-eslint/parser',
    rules: {
        'indent': [2, 4, { SwitchCase: 1 }],
        'max-len': [2, { code: 160 }],
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
                'js': 'always',
                'ts': 'never',
                'd.ts': 'never',
            }
        ],
    },
    settings: {
        'import/external-module-folders': ['../../node_modules', '../../node_modules/@types'],
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts']
        },
        'import/resolver': {
            // NOTE: These aliases must match aliases in webpack.config.js
            alias: {
                map: [
                    ['rili-public-library/react-components/*', path.join(__dirname, '../../rili-public-library/react-components/lib')],
                    ['rili-public-library/styles/*', path.join(__dirname, '../../rili-public-library/styles')],
                    ['rili-public-library/utilities/*', path.join(__dirname, '../../rili-public-library/utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.json', '.scss']
            },
            node: {
                extensions: ['.js', '.ts']
            }
        }
    }
};