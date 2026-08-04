const { RuleTester } = require('eslint');
const rule = require('../rules/no-partial-connection-status-check');

const ruleTester = new RuleTester({
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-partial-connection-status-check', rule, {
    valid: [
        // The sanctioned definition. Passes on its own merits so the helper needs no
        // disable comment — this is the shape every other check should route through.
        'const isCompletedConnection = (c) => !!c && c.requestStatus === UserConnectionTypes.COMPLETE && !c.isConnectionBroken;',

        // Optional chaining, either order of the two halves.
        'const ok = connection?.requestStatus === UserConnectionTypes.COMPLETE && !connection?.isConnectionBroken;',
        'const ok = !connection.isConnectionBroken && connection.requestStatus === UserConnectionTypes.COMPLETE;',

        // Guarded from further out in the same boolean expression.
        'const ok = c.isMe || (c.requestStatus === UserConnectionTypes.COMPLETE && !c.isConnectionBroken);',

        // Ternary whose test carries both halves.
        'const t = (c.requestStatus === UserConnectionTypes.COMPLETE && !c.isConnectionBroken) ? c.type : 0;',

        // A bare identifier is a different question: "is the client asking to accept this
        // request?", not a claim about stored connection state. See `updateUserConnection`.
        'const { requestStatus } = req.body; if (requestStatus === UserConnectionTypes.COMPLETE) { award(); }',

        // Query predicates are object properties, not comparisons.
        'Store.userConnections.countUserConnections(id, { requestStatus: UserConnectionTypes.COMPLETE });',
        'queryString.where({ isConnectionBroken: false, requestStatus: UserConnectionTypes.COMPLETE });',

        // Other statuses are none of this rule's business — the broken flag is meaningless
        // for a row that was never completed.
        'const p = friendship?.requestStatus === UserConnectionTypes.PENDING;',
        'const m = getResults[0]?.requestStatus !== UserConnectionTypes.MIGHT_KNOW;',
        "const p = notification.userConnection.requestStatus === 'pending';",

        // Unrelated property named the same as the enum member.
        'const x = response.COMPLETE === other.requestStatusCode;',

        // An earlier arm of the same if/else-if chain handled the broken case — reads as
        // naturally as `&& !isConnectionBroken` and is just as correct. This is the shape
        // websocket-service uses when deciding which socket event an update should emit.
        [
            'if (connection.isConnectionBroken) {',
            '    emitRemoved(connection);',
            '} else if (connection.requestStatus === UserConnectionTypes.COMPLETE) {',
            '    emitAccepted(connection);',
            '}',
        ].join('\n'),

        // Same, with the comparison nested inside a larger test.
        [
            'if (c.isConnectionBroken) {',
            '    a();',
            '} else if (isReady && c.requestStatus === UserConnectionTypes.COMPLETE) {',
            '    b();',
            '}',
        ].join('\n'),

        // Boundary worth stating: the *original* isNotConnected defect was phrased against
        // MIGHT_KNOW, not COMPLETE, so this rule would not have caught it. It guards the
        // half-predicate mistake — which is the one that recurred — not every way of getting
        // the connected question wrong.
        'const isNotConnected = !friendship || friendship.requestStatus === UserConnectionTypes.MIGHT_KNOW;',
    ],

    invalid: [
        {
            // The second defect from the same object literal — `connectionType` kept a
            // non-zero tier for a COMPLETE-but-broken row.
            code: 'const connectionType = friendship?.requestStatus === UserConnectionTypes.COMPLETE ? friendship.type : 0;',
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            code: 'const isConnected = connection.requestStatus === UserConnectionTypes.COMPLETE;',
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            // Raw string instead of the enum is the same mistake.
            code: "const isConnected = connection.requestStatus === 'complete';",
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            // Reversed operands.
            code: 'const isConnected = UserConnectionTypes.COMPLETE === connection.requestStatus;',
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            // Computed access must not be an escape hatch.
            code: 'const isConnected = connection["requestStatus"] === UserConnectionTypes["COMPLETE"];',
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            // Negated form reports the inverse just as wrongly.
            code: 'function f() { if (friendship.requestStatus !== UserConnectionTypes.COMPLETE) { return notConnected(); } }',
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            // `isConnectionBroken` on an unrelated branch of the ternary does not guard the test.
            code: 'const t = c.requestStatus === UserConnectionTypes.COMPLETE ? c.isConnectionBroken : 0;',
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            // Escaping the boolean expression (into a call argument) ends the outward walk.
            code: 'const ok = wrap(c.requestStatus === UserConnectionTypes.COMPLETE) && !c.isConnectionBroken;',
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            // A *separate* if statement is not the same chain, even in the same function —
            // this is the websocket-service defect, where one branch guarded the broken case
            // and a later `.then()` handler repeated the check without it.
            code: [
                'if (connection.isConnectionBroken) { emitRemoved(connection); }',
                'if (connection.requestStatus === UserConnectionTypes.COMPLETE) { notifyAccepted(connection); }',
            ].join('\n'),
            errors: [{ messageId: 'partialCheck' }],
        },
        {
            // The broken flag appearing in an if *body* rather than an earlier test proves nothing.
            code: 'if (c.requestStatus === UserConnectionTypes.COMPLETE) { log(c.isConnectionBroken); }',
            errors: [{ messageId: 'partialCheck' }],
        },
    ],
});

console.log('no-partial-connection-status-check: all RuleTester cases passed');
