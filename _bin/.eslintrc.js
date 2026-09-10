// Config for the CI/CD helper scripts and their tests.
//
// `_bin/lib/` holds the decision logic the deploy pipeline runs on, plus the Node
// tests that guard it (`npm run test:bin-scripts`). Nothing above this directory
// declares a config — packages each own theirs, and there is no root .eslintrc — so
// these files were previously unlintable: ESLint aborted with "couldn't find a
// configuration file" rather than skipping them.
//
// root: true stops the cascade here so this never leaks into a sibling package.
//
// Modelled on eslint-config/.eslintrc.js, which covers the shared-config directory
// for the same reason.

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
        // These are repo-local CI scripts, not a published package — they legitimately
        // require from the repo root's devDependencies.
        'import/no-extraneous-dependencies': 'off',
        // Matches eslint-config/base.js, which sets the repo-wide style.
        indent: ['error', 4, { SwitchCase: 1 }],
        'max-len': ['error', { code: 160, ignoreComments: true }],
        // CI scripts report progress on stdout; that is their entire output format.
        'no-console': 'off',
        // Matches eslint-config/base.js: airbnb's 'multiline' forces every multi-line
        // call to put each argument on its own line, which makes ordinary edits churny.
        'function-paren-newline': ['error', 'consistent'],
        // The test files group each case in a bare block, so a case's locals cannot
        // leak into the next one. That is their structure, not an oversight — these
        // are plain Node scripts with no describe/it to provide the scoping.
        'no-lone-blocks': 'off',
        // airbnb bans for...of on the grounds that it needs regenerator-runtime. These
        // scripts run on the repo's own Node 24, never through Babel, and iterating a
        // list of services or verdicts reads better as a loop than as a reduce.
        'no-restricted-syntax': 'off',
        // Off for the same reason, and it has to be: the loop idiom the rule above
        // permits is `for (const x of xs) { if (!wanted) { continue; } ... }`. Banning
        // `continue` while allowing the loop only forces the body into an extra level
        // of nesting. generate-declaration-barrels.js:70 is exactly that shape.
        'no-continue': 'off',
    },
};
