// Config for the shared ESLint configuration directory itself.
//
// `eslint-config/plugin/` contains real rule implementations and their tests, so it
// needs linting like any other source. Nothing above this directory declares a config
// (packages each own theirs), which meant these files were previously unlintable —
// ESLint aborted with "couldn't find a configuration file" rather than skipping.
//
// root: true stops the cascade here so this never leaks into a sibling package.

module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
    },
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script',
    },
    extends: ['airbnb-base'],
    rules: {
        // These files are CommonJS config modules, not an published package — they
        // legitimately require from the repo root's devDependencies.
        'import/no-extraneous-dependencies': 'off',
        // Matches eslint-config/base.js, which this directory configures.
        indent: ['error', 4, { SwitchCase: 1 }],
        'max-len': ['error', { code: 160, ignoreComments: true }],
        // Rule modules require their sibling rule files lazily in index.js.
        'global-require': 'off',
    },
    overrides: [
        {
            // Test files report progress on stdout; that is their output format.
            files: ['plugin/tests/**/*.js'],
            rules: {
                'no-console': 'off',
            },
        },
    ],
};
