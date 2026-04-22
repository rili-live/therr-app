// Shared ESLint base configuration for all TypeScript packages.
// Import and spread this into package-level .eslintrc.js files.

module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
    ],
    ignorePatterns: ['**/.eslintrc.js'],
    rules: {
        indent: [2, 4, { SwitchCase: 1 }],
        'max-len': [2, { code: 160 }],
        'no-shadow': 'off',
        'no-use-before-define': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-shadow': 'error',
        '@typescript-eslint/no-use-before-define': ['error'],
        '@typescript-eslint/ban-types': 'off',
        'consistent-return': 'off',
        'prefer-destructuring': 'off',
        'import/prefer-default-export': 'off',
        'import/no-relative-packages': 'off',
    },
};
