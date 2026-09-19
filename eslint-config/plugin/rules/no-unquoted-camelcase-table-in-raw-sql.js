// Forbid a camelCase table name reaching raw SQL unquoted.
//
// Knex's query builder quotes identifiers. Raw SQL does not, and Postgres folds every
// unquoted identifier to lowercase — so `INSERT INTO main.leaderboardPeriodResults` looks up
// `main.leaderboardperiodresults`, which never exists, and fails with
// `relation "main.leaderboardperiodresults" does not exist`. That shipped to production on
// 2026-09-19: the store's builder methods worked, the one raw INSERT never could, and the unit
// test stubbed it. The snake_case `habits.*` tables only survive because folding is a no-op on
// them, which is why the pattern had never bitten before.
//
// The rule looks at every string that puts a table name in table position — the token after
// FROM / JOIN / INTO / UPDATE / TABLE, or a name used as a column qualifier (`${T}."col"`) —
// and requires one of:
//
//   - a static name with no uppercase letters              FROM habits.pacts
//   - an already-quoted name                               FROM main."userLocations"
//   - an interpolation the rule can resolve to such a name  FROM ${PACTS_TABLE_NAME}
//   - an interpolation wrapped in the quoting helper        FROM ${quoteTableName(this.tableName)}
//
// Resolution follows `const X = '…'` in the same file and `import { X } from './relative'`
// one hop into that file (an `export const X = '…'` line). Anything else — `this.tableName`,
// a function parameter, an import the rule cannot read — is reported: not because it is wrong,
// but because nothing can prove it right, and the failure mode is a query that cannot succeed.
// Wrapping it in `quoteTableName()` (therr-js-utilities/db) is always correct.
//
// Keywords are matched case-sensitively in uppercase. SQL in this repo is written that way,
// and prose in a template literal ("… coins from ${provider}") must not trip the rule.

const fs = require('fs');
const path = require('path');

const DEFAULT_QUOTE_HELPERS = ['quoteTableName'];

// The static text immediately before an interpolation puts it in table position. Two SQL
// forms put a value, not a table, after FROM — `EXTRACT(EPOCH FROM …)` and
// `IS DISTINCT FROM …` — and are excluded so a parameter there is not reported as an
// unverifiable table name. A camelCase qualifier in either (`EPOCH FROM ${T}."createdAt"`)
// is still caught by the qualifier check below.
const TABLE_POSITION_BEFORE = /(?<!\b(?:EPOCH|DISTINCT)\s+)\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+$/;
// The static text immediately after an interpolation uses it as a column qualifier:
// `${T}."createdAt"` or `${T}.id) AS …`. A sentence that ends on an interpolation
// (`… for ${name}.`) does not match.
const QUALIFIER_AFTER = /^\.(?:"|[A-Za-z_]\w*(?=\s*[=<>!),]|\s+(?:AS|IS|IN|NOT|ASC|DESC|AND|OR)\b))/;
// The qualifier check only applies inside something that reads as SQL: text with a SQL
// keyword in it, or a string handed to one of knex's raw-SQL entry points (`raw`,
// `whereRaw`, `andWhereRaw`, `joinRaw`, …), where a fragment like `${T}."createdAt" <= NOW()`
// carries no keyword of its own.
const LOOKS_LIKE_SQL = /\b(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|ON CONFLICT)\b/;
const RAW_SQL_CALLEE = /raw$/i;

const isRawSqlArgument = (node) => {
    let current = node;
    while (current.parent && (
        current.parent.type === 'BinaryExpression'
        || current.parent.type === 'TemplateLiteral'
        || current.parent.type === 'ConditionalExpression'
        || current.parent.type === 'LogicalExpression'
    )) {
        current = current.parent;
    }
    const call = current.parent;
    if (!call || call.type !== 'CallExpression' || !call.arguments.includes(current)) {
        return false;
    }
    const { callee } = call;
    if (callee.type === 'Identifier') {
        return RAW_SQL_CALLEE.test(callee.name);
    }
    return callee.type === 'MemberExpression' && callee.property.type === 'Identifier' && RAW_SQL_CALLEE.test(callee.property.name);
};
// A bare schema-qualified name in table position inside static SQL text. The table part must
// start with a letter, so a quoted `main."name"` does not match.
const BARE_QUALIFIED_IN_TABLE_POSITION = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([A-Za-z_]\w*\.[A-Za-z_]\w*)/g;

const needsQuoting = (qualified) => /[A-Z]/.test(qualified);

// What a `const t = quoteTableName(x)` binding resolves to: not a name, but something the
// quoted-name check accepts on sight.
const QUOTED_BY_HELPER = '"';

const quotedForm = (qualified) => {
    const separator = qualified.indexOf('.');
    if (separator < 0) {
        return `"${qualified}"`;
    }
    return `${qualified.slice(0, separator)}."${qualified.slice(separator + 1)}"`;
};

const RESOLUTION_EXTENSIONS = ['.ts', '.js', '/index.ts', '/index.js'];
// Keyed on path + mtime so an editor-hosted ESLint server, which outlives any one lint run,
// re-reads a `tableNames.ts` after it is edited instead of serving the first text it saw.
const importedConstantCache = new Map();

// `export const NAME = '…'` from a relative module, read straight off disk. One hop only;
// re-exports and computed values are out of scope and resolve as unknown.
const readExportedConstant = (fromFile, source, name) => {
    if (!source.startsWith('.')) {
        return null;
    }
    const base = path.resolve(path.dirname(fromFile), source);
    const candidates = RESOLUTION_EXTENSIONS.map((extension) => `${base}${extension}`);
    const target = candidates.find((candidate) => fs.existsSync(candidate));
    if (!target) {
        return null;
    }

    let cacheKey = target;
    try {
        cacheKey = `${target}:${fs.statSync(target).mtimeMs}`;
    } catch (error) {
        // Unreadable stat: fall through to the read, which records '' for the path.
    }

    let text = importedConstantCache.get(cacheKey);
    if (text === undefined) {
        try {
            text = fs.readFileSync(target, 'utf8');
        } catch (error) {
            text = '';
        }
        importedConstantCache.set(cacheKey, text);
    }

    const declaration = new RegExp(`export\\s+const\\s+${name}\\s*(?::\\s*[^=]+?)?=\\s*(['"\`])([^'"\`]+)\\1`);
    const match = text.match(declaration);
    return match ? match[2] : null;
};

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require camelCase table names to be quoted (or provably lowercase) in raw SQL',
            recommended: true,
        },
        schema: [
            {
                type: 'object',
                properties: {
                    quoteHelpers: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            bareCamelCase:
                'Table "{{table}}" is camelCase and unquoted in raw SQL. Postgres folds it to lowercase and the '
                + 'query fails with `relation "{{folded}}" does not exist`. Write {{quoted}}, or wrap the '
                + 'interpolated name in quoteTableName() from therr-js-utilities/db.',
            unresolvableTable:
                'Cannot verify that this interpolated table name is lowercase, and an unquoted camelCase name '
                + 'is folded by Postgres into a relation that does not exist. Wrap it in quoteTableName() '
                + 'from therr-js-utilities/db.',
        },
    },

    create(context) {
        const quoteHelpers = (context.options[0] || {}).quoteHelpers || DEFAULT_QUOTE_HELPERS;
        const sourceCode = context.sourceCode || context.getSourceCode();
        const filename = context.filename || context.getFilename();

        const scopeOf = (node) => (sourceCode.getScope ? sourceCode.getScope(node) : context.getScope());

        const lookupVariable = (node) => {
            let scope = scopeOf(node);
            while (scope) {
                const variable = scope.set.get(node.name);
                if (variable) {
                    return variable;
                }
                scope = scope.upper;
            }
            return null;
        };

        const isQuoteHelperCall = (node) => {
            if (!node || node.type !== 'CallExpression') {
                return false;
            }
            const { callee } = node;
            if (callee.type === 'Identifier') {
                return quoteHelpers.includes(callee.name);
            }
            if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
                return quoteHelpers.includes(callee.property.name);
            }
            return false;
        };

        // The string an expression evaluates to, when that can be established statically;
        // `null` when it cannot.
        const resolveStatic = (node, depth = 0) => {
            if (!node || depth > 5) {
                return null;
            }
            if (node.type === 'Literal') {
                return typeof node.value === 'string' ? node.value : null;
            }
            if (node.type === 'TemplateLiteral') {
                return node.expressions.length === 0 ? node.quasis[0].value.cooked : null;
            }
            if (node.type === 'TSAsExpression' || node.type === 'TSNonNullExpression') {
                return resolveStatic(node.expression, depth + 1);
            }
            if (node.type !== 'Identifier') {
                return null;
            }

            const variable = lookupVariable(node);
            const definition = variable && variable.defs[0];
            if (!definition) {
                return null;
            }

            if (definition.type === 'Variable') {
                const isConst = definition.parent && definition.parent.kind === 'const';
                if (!isConst || definition.node.id.type !== 'Identifier') {
                    return null;
                }
                // `const t = quoteTableName(x)` is quoted by construction, whatever x is.
                if (definition.node.init && isQuoteHelperCall(definition.node.init)) {
                    return QUOTED_BY_HELPER;
                }
                return resolveStatic(definition.node.init, depth + 1);
            }

            if (definition.type === 'ImportBinding' && definition.node.type === 'ImportSpecifier') {
                return readExportedConstant(filename, definition.parent.source.value, definition.node.imported.name);
            }

            return null;
        };

        const checkTablePositionExpression = (expression) => {
            if (isQuoteHelperCall(expression)) {
                return;
            }

            const value = resolveStatic(expression);
            if (value === null) {
                context.report({ node: expression, messageId: 'unresolvableTable' });
                return;
            }

            // A resolved value that is already quoted (`main."x"`) is fine, as is a lowercase one.
            if (value.includes('"') || !needsQuoting(value)) {
                return;
            }

            context.report({
                node: expression,
                messageId: 'bareCamelCase',
                data: { table: value, folded: value.toLowerCase(), quoted: quotedForm(value) },
            });
        };

        const checkStaticText = (node, text) => {
            if (!text) {
                return;
            }
            BARE_QUALIFIED_IN_TABLE_POSITION.lastIndex = 0;
            let match = BARE_QUALIFIED_IN_TABLE_POSITION.exec(text);
            while (match) {
                const table = match[1];
                if (needsQuoting(table)) {
                    context.report({
                        node,
                        messageId: 'bareCamelCase',
                        data: { table, folded: table.toLowerCase(), quoted: quotedForm(table) },
                    });
                }
                match = BARE_QUALIFIED_IN_TABLE_POSITION.exec(text);
            }
        };

        // The static text a `+` chain ends with, for `'… FROM ' + TABLE`.
        const trailingStaticText = (node) => {
            if (node.type === 'Literal' && typeof node.value === 'string') {
                return node.value;
            }
            if (node.type === 'TemplateLiteral') {
                return node.quasis[node.quasis.length - 1].value.cooked;
            }
            if (node.type === 'BinaryExpression' && node.operator === '+') {
                return trailingStaticText(node.right);
            }
            return null;
        };

        return {
            Literal(node) {
                if (typeof node.value === 'string') {
                    checkStaticText(node, node.value);
                }
            },

            TemplateLiteral(node) {
                const isSql = LOOKS_LIKE_SQL.test(node.quasis.map((quasi) => quasi.value.cooked).join(' '))
                    || isRawSqlArgument(node);
                node.quasis.forEach((quasi, index) => {
                    checkStaticText(quasi, quasi.value.cooked);

                    const expression = node.expressions[index];
                    if (!expression) {
                        return;
                    }
                    const before = quasi.value.cooked || '';
                    const after = (node.quasis[index + 1] && node.quasis[index + 1].value.cooked) || '';
                    if (TABLE_POSITION_BEFORE.test(before) || (isSql && QUALIFIER_AFTER.test(after))) {
                        checkTablePositionExpression(expression);
                    }
                });
            },

            BinaryExpression(node) {
                if (node.operator !== '+') {
                    return;
                }
                const before = trailingStaticText(node.left);
                if (before === null || !TABLE_POSITION_BEFORE.test(before)) {
                    return;
                }
                // A string on the right is checked as its own Literal/TemplateLiteral visit.
                if (node.right.type === 'Literal' || node.right.type === 'TemplateLiteral') {
                    return;
                }
                checkTablePositionExpression(node.right);
            },
        };
    },
};
