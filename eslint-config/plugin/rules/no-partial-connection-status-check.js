// Forbid asking "are these two users connected?" with `requestStatus === COMPLETE` alone.
//
// A row in main."userConnections" is only a live connection when it is BOTH
// `requestStatus = 'complete'` AND `isConnectionBroken = false`. That is the exact
// predicate `UserConnectionsStore.searchUserConnections` filters the connections list on,
// so any check that drops the `isConnectionBroken` half answers a *different* question
// than the connections list does — and the two screens then disagree about the same pair
// of users.
//
// This has already shipped twice from the same object literal in
// `users-service/src/handlers/helpers/user.ts`:
//
//   - `isNotConnected` reported a pending, denied or *broken* row as connected, so a
//     profile the connections list had already dropped still rendered a Message button.
//   - `connectionType` kept returning a non-zero connection *tier* for a broken row after
//     the first fix landed, so mobile's `connectionType > 0` checks (HeaderMenuRight,
//     UserSheet) kept drawing the connection-tier icon on a profile the same response
//     had just called not connected.
//
// The rule fires on a comparison that reads `.requestStatus` off an object and compares it
// to COMPLETE without `isConnectionBroken` appearing anywhere in the surrounding logical
// or conditional expression. Two deliberate consequences:
//
//   - `isCompletedConnection` — `c.requestStatus === COMPLETE && !c.isConnectionBroken` —
//     passes on its own merits, no disable comment needed. Route new checks through it.
//   - A bare identifier (`const { requestStatus } = req.body; requestStatus === COMPLETE`)
//     is NOT flagged. That is a different question — "is the client asking to accept this
//     request?" — not a claim about connection state. See `updateUserConnection`.
//
// Query predicates (`.where({ requestStatus: COMPLETE })`, `countUserConnections(id, {...})`)
// are object properties rather than comparisons and are likewise out of scope.

const STATUS_PROPERTY = 'requestStatus';
const BROKEN_PROPERTY = 'isConnectionBroken';
const COMPLETE_ENUM = 'COMPLETE';
const COMPLETE_VALUE = 'complete';
const EQUALITY_OPERATORS = ['===', '!==', '==', '!='];

// ESTree wraps an optional chain in a ChainExpression, so `a?.requestStatus` arrives as
// ChainExpression -> MemberExpression. Unwrap before looking at the property.
const unwrapChain = (node) => (node && node.type === 'ChainExpression' ? node.expression : node);

const propertyNameOf = (node) => {
    const member = unwrapChain(node);

    if (!member || (member.type !== 'MemberExpression' && member.type !== 'OptionalMemberExpression')) {
        return null;
    }

    return (member.property && (member.property.name
        || (typeof member.property.value === 'string' ? member.property.value : null))) || null;
};

// `a.requestStatus`, `a?.requestStatus`, `a["requestStatus"]` — but not a bare `requestStatus`.
const isStatusMemberRead = (node) => propertyNameOf(node) === STATUS_PROPERTY;

// `UserConnectionTypes.COMPLETE`, `UserConnectionTypes['COMPLETE']`, or the raw 'complete'.
const isCompleteReference = (node) => {
    const unwrapped = unwrapChain(node);

    if (!unwrapped) {
        return false;
    }

    if (unwrapped.type === 'Literal') {
        return unwrapped.value === COMPLETE_VALUE;
    }

    return propertyNameOf(unwrapped) === COMPLETE_ENUM;
};

const mentionsBrokenFlag = (node, sourceCode) => !!node && sourceCode.getText(node).includes(BROKEN_PROPERTY);

// Walk outward through the boolean expression this comparison belongs to, looking for
// `isConnectionBroken` in a position that actually gates it. Mentioning the flag somewhere
// in the enclosing text is not enough — it has to be on a branch that runs together with
// this comparison, which is why siblings are inspected individually rather than as one blob.
const isGuardedByBrokenCheck = (node, sourceCode) => {
    let current = node;
    let { parent } = node;

    while (parent) {
        if (parent.type === 'LogicalExpression') {
            const sibling = parent.left === current ? parent.right : parent.left;

            if (mentionsBrokenFlag(sibling, sourceCode)) {
                return true;
            }
        } else if (parent.type === 'ConditionalExpression') {
            // A ternary's branches never guard its own test; only its test guards a branch.
            if (parent.test !== current && mentionsBrokenFlag(parent.test, sourceCode)) {
                return true;
            }
        } else if (parent.type === 'IfStatement' && parent.test === current) {
            // `if (c.isConnectionBroken) { … } else if (c.requestStatus === COMPLETE) { … }`
            // handles the broken case in an earlier arm of the same chain, which reads as
            // naturally as `&& !c.isConnectionBroken` and is just as correct. Walk back up
            // the else-if chain looking for an arm that tested the flag.
            let arm = parent;

            while (arm.parent && arm.parent.type === 'IfStatement' && arm.parent.alternate === arm) {
                if (mentionsBrokenFlag(arm.parent.test, sourceCode)) {
                    return true;
                }

                arm = arm.parent;
            }

            return false;
        } else if (parent.type !== 'UnaryExpression' && parent.type !== 'ChainExpression') {
            // Anything else — a call argument, a return, a property value — ends the
            // boolean expression, so nothing further out can be gating this comparison.
            return false;
        }

        current = parent;
        parent = parent.parent;
    }

    return false;
};

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require isConnectionBroken alongside a requestStatus === COMPLETE connection check',
            recommended: true,
        },
        schema: [],
        messages: {
            partialCheck:
                'A connection is only live when `requestStatus` is COMPLETE *and* `isConnectionBroken` is '
                + 'false — that is the predicate `searchUserConnections` filters the connections list on. '
                + 'Checking `requestStatus` alone reports a broken (unconnected) row as connected, so this '
                + 'screen and the connections list disagree about the same pair of users. Use the shared '
                + '`isCompletedConnection` helper, or add the `isConnectionBroken` half. '
                + 'See eslint-config/plugin/rules/no-partial-connection-status-check.js.',
        },
    },

    create(context) {
        const sourceCode = context.getSourceCode();

        return {
            BinaryExpression(node) {
                if (!EQUALITY_OPERATORS.includes(node.operator)) {
                    return;
                }

                const comparesStatusToComplete = (isStatusMemberRead(node.left) && isCompleteReference(node.right))
                    || (isStatusMemberRead(node.right) && isCompleteReference(node.left));

                if (!comparesStatusToComplete) {
                    return;
                }

                if (isGuardedByBrokenCheck(node, sourceCode)) {
                    return;
                }

                context.report({ node, messageId: 'partialCheck' });
            },
        };
    },
};

module.exports.STATUS_PROPERTY = STATUS_PROPERTY;
module.exports.BROKEN_PROPERTY = BROKEN_PROPERTY;
