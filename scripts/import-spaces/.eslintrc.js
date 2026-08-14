const createServiceConfig = require('../../eslint-config/service');

module.exports = createServiceConfig(__dirname, {
    rules: {
        'no-console': 'off',
        'no-plusplus': 'off',
        'no-await-in-loop': 'off',
        'no-restricted-syntax': 'off',
        // These standalone CLI scripts were written 2-space throughout, unlike the
        // 4-space services. Reformatting ~4k lines to satisfy the shared rule would
        // bury the actual findings, so the rule matches the directory's real style.
        indent: ['error', 2, { SwitchCase: 1 }],
        '@typescript-eslint/indent': ['error', 2, { SwitchCase: 1 }],
        // Scanner loops over HTML/regex matches and byte-level image header parsing
        // are the bulk of this directory; `continue` and bitwise ops are the clear
        // way to express both.
        'no-continue': 'off',
        'no-bitwise': 'off',
        // Every script here threads a mutable `counters` accumulator through its
        // phase functions, and hoisted function declarations are used freely.
        'no-param-reassign': ['error', { props: false }],
        '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
    },
});
