const path = require('path');

module.exports = {
  root: true,
  env: {
    jest: true
},
  extends: '@react-native-community',
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
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
    'max-len': [2, { code: 160 }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/interface-name-prefix': 0,
    '@typescript-eslint/no-empty-interface': 0,
    'consistent-return': 'off',
    'prefer-destructuring': 'off',
    "prettier/prettier": ["warn", {"singleQuote": true, "parser": "typescript"}],
    'import/prefer-default-export': 'off'
  },
  settings: {
    'import/external-module-folders': ['../node_modules', '../node_modules/@types'],
    'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
        // NOTE: These aliases must match aliases in webpack.config.js
        alias: {
            map: [
                ['shared/*', path.join(__dirname, '../node_modules')],
                ['rili-public-library/react-components/*', path.join(__dirname, '../rili-public-library/react-components/lib')],
                ['rili-public-library/styles/*', path.join(__dirname, '../rili-public-library/styles/lib')],
                ['rili-public-library/utilities/*', path.join(__dirname, '../rili-public-library/utilities/lib')],
            ],
            extensions: ['.js', '.jsx', '.ts', '.json', '.scss'],
        },
        node: {
            extensions: ['.js', '.jsx', '.ts', '.tsx']
        }
    },
    react: {
        version: 'detect',
    }
}
};
