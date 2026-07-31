// Require new Knex migrations to be idempotent — safe to apply more than once.
//
// Why this is an invariant and not a style preference:
//
// Knex records applied migrations in `knex_migrations`, but that row is only written
// *after* the migration function resolves. A migration that dies partway through — a
// deploy killed mid-run, a statement timeout on a large table, a transient connection
// drop, `config.transaction = false` on a multi-statement migration — leaves the schema
// half-changed and the ledger row absent. The next deploy runs the same migration again
// from the top, hits `CREATE INDEX ...` for the index it already created, and fails.
// Recovery is a human with psql on production, at whatever hour the deploy ran.
//
// The same applies to `down`: a rollback that fails partway leaves a schema that the
// re-run of `down` cannot process.
//
// An idempotent migration turns that whole failure class into "run it again". Every
// statement checks for its own effect first, so re-application is a no-op rather than
// an error.
//
// What this rule checks, in three groups:
//
//   1. Knex schema-builder calls with a drop-in idempotent counterpart
//      (`dropTable` -> `dropTableIfExists`, `createSchema` -> `createSchemaIfNotExists`,
//      ...). Mechanical fix, no judgement needed, so this is always an error.
//
//   2. Knex schema-builder calls with NO idempotent counterpart — `createTable`,
//      `alterTable`/`table` callbacks that add or drop columns, indexes, or
//      constraints. These need an explicit `hasTable`/`hasColumn` probe, or raw SQL
//      carrying its own `IF [NOT] EXISTS`.
//
//      Note `createTableIfNotExists` is NOT the fix for `createTable`: Knex itself logs
//      "it should not be used when writing new code" because it emits a bare
//      `CREATE TABLE IF NOT EXISTS` and silently drops the follow-up ALTER statements
//      Knex generates for some column types. The rule flags it for that reason.
//
//   3. Raw SQL DDL missing its guard — `CREATE INDEX` without `IF NOT EXISTS`,
//      `DROP CONSTRAINT` without `IF EXISTS`, and the Postgres statements that have no
//      inline guard at all (`ADD CONSTRAINT`, `CREATE TYPE`, `CREATE TRIGGER`,
//      `CREATE POLICY`), which must be preceded by the matching `DROP ... IF EXISTS`.
//      `CREATE FUNCTION`/`CREATE VIEW` want `CREATE OR REPLACE` instead.
//
// Scope: only migrations dated at or after the `since` cutoff configured in
// eslint-config/service.js. The ~190 migrations that predate the rule are already
// deployed everywhere and rewriting them buys nothing, so they stay exempt — this gate
// is about every migration written from here on. A file whose name carries no
// `YYYYMMDDHHMMSS` prefix is checked regardless, so an off-convention filename is not a
// way out. See eslint-config/migration-idempotency-cutoff.js.
//
// Known limitation: a probe is credited at migration-function granularity — if
// `exports.up` probes `hasColumn('users', 'a')` and then alters `users` twice, both
// alters are treated as guarded. Matching a probe to the specific statement it protects
// needs dataflow analysis this rule does not do. The `if (!hasX)` shape it does verify
// is the one that actually goes wrong; two alters under one probe is a review comment,
// not a production incident.
//
// Escape hatch, for the genuinely exotic case:
//   // eslint-disable-next-line therr/require-idempotent-migration -- <why>

const path = require('path');

// Group 1: Knex schema-builder methods whose idempotent counterpart is a rename.
const DROP_IN_REPLACEMENTS = {
    dropTable: 'dropTableIfExists',
    dropSchema: 'dropSchemaIfExists',
    dropView: 'dropViewIfExists',
    dropMaterializedView: 'dropMaterializedViewIfExists',
    dropExtension: 'dropExtensionIfExists',
    createSchema: 'createSchemaIfNotExists',
    createExtension: 'createExtensionIfNotExists',
    createView: 'createViewOrReplace',
};

// Group 2: Knex schema-builder methods with no idempotent counterpart. Need a probe.
const PROBE_REQUIRED_METHODS = new Set([
    'createTable',
    'createTableLike',
    'renameTable',
]);

// Knex maps `.table(name, cb)` onto `alterTable` internally. Both take a builder callback;
// `knex.table(name)` without one is an ordinary query builder and none of this rule's business.
const ALTER_TABLE_METHODS = new Set(['alterTable', 'table']);

const PROBE_METHODS = new Set(['hasTable', 'hasColumn', 'hasIndex']);

// `table.*` operations Postgres already applies repeatably. `ALTER COLUMN ... DROP NOT NULL`
// on a column that is already nullable is a no-op, not an error; so is re-applying a type
// change or a comment. Anything else inside an alterTable callback — adding a column,
// dropping one, creating an index, adding a foreign key — is not.
const REPEATABLE_COLUMN_OPS = new Set(['dropNullable', 'setNullable', 'comment']);

// A chain terminating in `.alter()` is an ALTER COLUMN, which re-applies cleanly, even though
// it starts with a column-type method: `table.string('x', 500).notNullable().alter()`.
const REPEATABLE_CHAIN_TERMINATORS = new Set(['alter']);

// Group 3a: raw DDL that supports an inline IF [NOT] EXISTS guard.
//
// Every pattern ends `KEYWORD\b(?!\s+IF ...)` rather than `KEYWORD\s+(?!IF ...)`. The second
// form looks equivalent and is not: `\s+` is greedy and backtracks, so on
// `DROP INDEX  IF EXISTS` it gives back a space, the lookahead then sees ` IF EXISTS` (which
// does not start with `IF`), and the guarded statement matches as unguarded. Keeping the
// whitespace inside the lookahead leaves the engine nothing to backtrack into.
const RAW_INLINE_GUARD_RULES = [
    {
        statement: 'CREATE TABLE',
        guard: 'IF NOT EXISTS',
        pattern: /\bCREATE\s+(?:(?:GLOBAL|LOCAL|TEMP|TEMPORARY|UNLOGGED)\s+)*TABLE\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    },
    {
        statement: 'CREATE SCHEMA',
        guard: 'IF NOT EXISTS',
        pattern: /\bCREATE\s+SCHEMA\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    },
    {
        statement: 'CREATE INDEX',
        guard: 'IF NOT EXISTS',
        pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    },
    {
        statement: 'CREATE SEQUENCE',
        guard: 'IF NOT EXISTS',
        pattern: /\bCREATE\s+SEQUENCE\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    },
    {
        statement: 'CREATE EXTENSION',
        guard: 'IF NOT EXISTS',
        pattern: /\bCREATE\s+EXTENSION\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    },
    {
        statement: 'CREATE MATERIALIZED VIEW',
        guard: 'IF NOT EXISTS',
        pattern: /\bCREATE\s+MATERIALIZED\s+VIEW\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    },
    {
        statement: 'ADD COLUMN',
        guard: 'IF NOT EXISTS',
        pattern: /\bADD\s+COLUMN\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    },
    {
        // DROP DEFAULT / DROP NOT NULL / DROP IDENTITY are deliberately absent: Postgres
        // already applies those repeatably, so demanding a guard would be noise.
        statement: 'DROP',
        guard: 'IF EXISTS',
        pattern: new RegExp(
            '\\bDROP\\s+(TABLE|INDEX|SCHEMA|SEQUENCE|EXTENSION|MATERIALIZED\\s+VIEW|VIEW'
            + '|TYPE|TRIGGER|FUNCTION|PROCEDURE|POLICY|COLUMN|CONSTRAINT)\\b'
            + '(?!\\s+IF\\s+EXISTS\\b)',
            'gi',
        ),
    },
];

// Group 3b: raw DDL Postgres gives no inline guard for. The idempotent form is to drop the
// object first, so re-running lands on a clean slate.
const RAW_DROP_FIRST_RULES = [
    {
        statement: 'ADD CONSTRAINT',
        pattern: /\bADD\s+CONSTRAINT\s+"?([A-Za-z0-9_$]+)"?/gi,
        pairKeyword: 'DROP CONSTRAINT IF EXISTS',
        pairPattern: /\bDROP\s+CONSTRAINT\s+IF\s+EXISTS\s+"?([A-Za-z0-9_$]+)"?/gi,
    },
    {
        statement: 'CREATE TYPE',
        pattern: /\bCREATE\s+TYPE\s+(?:[A-Za-z0-9_$]+\.)?"?([A-Za-z0-9_$]+)"?/gi,
        pairKeyword: 'DROP TYPE IF EXISTS',
        pairPattern: /\bDROP\s+TYPE\s+IF\s+EXISTS\s+(?:[A-Za-z0-9_$]+\.)?"?([A-Za-z0-9_$]+)"?/gi,
    },
    {
        statement: 'CREATE TRIGGER',
        pattern: /\bCREATE\s+(?!OR\s+REPLACE\s+)(?:CONSTRAINT\s+)?TRIGGER\s+"?([A-Za-z0-9_$]+)"?/gi,
        pairKeyword: 'DROP TRIGGER IF EXISTS',
        pairPattern: /\bDROP\s+TRIGGER\s+IF\s+EXISTS\s+"?([A-Za-z0-9_$]+)"?/gi,
    },
    {
        statement: 'CREATE POLICY',
        pattern: /\bCREATE\s+POLICY\s+"?([A-Za-z0-9_$]+)"?/gi,
        pairKeyword: 'DROP POLICY IF EXISTS',
        pairPattern: /\bDROP\s+POLICY\s+IF\s+EXISTS\s+"?([A-Za-z0-9_$]+)"?/gi,
    },
];

// Group 3c: raw DDL whose idempotent form is CREATE OR REPLACE. The patterns cannot match a
// statement that already says OR REPLACE, so no separate exemption is needed.
const RAW_OR_REPLACE_RULES = [
    { statement: 'CREATE FUNCTION', replacement: 'CREATE OR REPLACE FUNCTION', pattern: /\bCREATE\s+FUNCTION\b/gi },
    { statement: 'CREATE PROCEDURE', replacement: 'CREATE OR REPLACE PROCEDURE', pattern: /\bCREATE\s+PROCEDURE\b/gi },
    { statement: 'CREATE VIEW', replacement: 'CREATE OR REPLACE VIEW', pattern: /\bCREATE\s+VIEW\b/gi },
];

// A `DO $$ ... $$` block is Postgres' own escape hatch for conditional DDL, and the only
// sane way to express some guards (adding a constraint without dropping it first, say).
// Writing one is an explicit statement that the author handled repeatability, so the
// literal containing it is left alone.
const DO_BLOCK = /\bDO\s+\$[A-Za-z0-9_]*\$/i;

const MIGRATION_TIMESTAMP = /^(\d{14})_/;

// Raw SQL is only inspected where it is unambiguously SQL: the arguments of a `.raw()` call,
// and string constants named like SQL. Scanning every string literal in the file instead would
// flag prose — a log line reading "drop table names into the report" is not a DDL statement.
const RAW_METHOD = 'raw';
const SQL_VARIABLE_NAME = /(?:sql|ddl|query|statement|stmt)/i;

const SQL_LINE_COMMENT = /--[^\n]*/g;
const SQL_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

// `CONCURRENTLY` sits between the object keyword and the `IF [NOT] EXISTS` guard, where an
// optional group in each pattern would backtrack past the guard and match anyway
// (`DROP INDEX CONCURRENTLY IF EXISTS` reading as an unguarded `DROP INDEX CONCURRENTLY`).
// It has no bearing on repeatability, so it is dropped before matching instead.
const CONCURRENTLY = /\bCONCURRENTLY\b/gi;

/** Static method name for `a.b()` and `a['b']()` alike; null for anything computed at runtime. */
const staticMethodName = (callee) => {
    if (!callee || callee.type !== 'MemberExpression' || !callee.property) {
        return null;
    }
    if (!callee.computed) {
        return callee.property.name || null;
    }
    return typeof callee.property.value === 'string' ? callee.property.value : null;
};

const stringArg = (node, index) => {
    const arg = node.arguments[index];
    return arg && arg.type === 'Literal' && typeof arg.value === 'string' ? arg.value : null;
};

const functionArg = (node) => node.arguments.find((arg) => arg.type === 'ArrowFunctionExpression'
    || arg.type === 'FunctionExpression');

/**
 * The outermost enclosing function — for a call inside `exports.up = async (knex) => {...}`
 * that is the arrow itself, whether the call sits in the body or nested in a `.then()`.
 * Used to scope hasTable/hasColumn probes to the migration direction that issued them, so a
 * probe in `up` cannot vouch for an unguarded statement in `down`.
 */
const enclosingMigrationFunction = (node) => {
    let outermost = null;
    let current = node.parent;
    while (current) {
        if (current.type === 'ArrowFunctionExpression'
            || current.type === 'FunctionExpression'
            || current.type === 'FunctionDeclaration') {
            outermost = current;
        }
        current = current.parent;
    }
    return outermost;
};

/** True when the call sits inside a conditional — the `if (!(await knex.schema.hasTable(...)))` shape. */
const isConditionallyExecuted = (node) => {
    let current = node.parent;
    while (current) {
        if (current.type === 'IfStatement'
            || current.type === 'ConditionalExpression'
            || current.type === 'LogicalExpression'
            || current.type === 'SwitchCase') {
            return true;
        }
        // Deliberately does not stop at function boundaries: the conditional often wraps a
        // whole `.then()` callback rather than the builder call directly.
        current = current.parent;
    }
    return false;
};

/**
 * Method names in a `table.string('x').notNullable().alter()` chain, outermost call first.
 * Used to tell a repeatable ALTER COLUMN from a non-repeatable ADD COLUMN.
 */
const chainMethodNames = (node) => {
    const names = [];
    let current = node;
    while (current && current.type === 'CallExpression') {
        const name = staticMethodName(current.callee);
        if (name) {
            names.push(name);
        }
        current = current.callee && current.callee.type === 'MemberExpression'
            ? current.callee.object
            : null;
    }
    return names;
};

/** Statements of a builder callback body, handling both block and concise-arrow forms. */
const callbackStatements = (fn) => {
    if (fn.body.type !== 'BlockStatement') {
        return [{ type: 'ExpressionStatement', expression: fn.body }];
    }
    return fn.body.body;
};

/** True when every operation in the alterTable callback re-applies cleanly. */
const alterCallbackIsRepeatable = (fn) => callbackStatements(fn).every((statement) => {
    if (statement.type !== 'ExpressionStatement') {
        // Anything other than a plain builder call (a loop, a conditional, an assignment)
        // is not something this rule can prove repeatable.
        return false;
    }
    const names = chainMethodNames(statement.expression);
    if (names.length === 0) {
        return false;
    }
    if (names.some((name) => REPEATABLE_CHAIN_TERMINATORS.has(name))) {
        return true;
    }
    // Innermost call is the operation; the rest of the chain are modifiers on it.
    return REPEATABLE_COLUMN_OPS.has(names[names.length - 1]);
});

/** Concatenated text of a string or template literal, with interpolations neutralised. */
const literalSqlText = (node) => {
    if (node.type === 'Literal') {
        return typeof node.value === 'string' ? node.value : null;
    }
    // Interpolated values become a placeholder identifier so they cannot fuse two keywords
    // across the seam (`CREATE IND` + `EX` must not read as `CREATE INDEX`).
    return node.quasis.map((quasi) => quasi.value.cooked || '').join('   ');
};

const normaliseSql = (sql) => sql
    .replace(SQL_BLOCK_COMMENT, ' ')
    .replace(SQL_LINE_COMMENT, ' ')
    .replace(CONCURRENTLY, ' ');

const collectNames = (sql, pattern) => {
    const names = new Set();
    const regex = new RegExp(pattern.source, pattern.flags);
    let match = regex.exec(sql);
    while (match) {
        names.add(match[1].toLowerCase());
        match = regex.exec(sql);
    }
    return names;
};

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require Knex migrations to be idempotent (safe to re-apply after a partial failure)',
            recommended: true,
        },
        schema: [
            {
                type: 'object',
                properties: {
                    // Migrations whose YYYYMMDDHHMMSS filename prefix sorts before this are exempt.
                    since: { type: 'string', pattern: '^\\d{14}$' },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            dropInReplacement:
                '`{{method}}` fails if the migration is re-run after a partial failure. Use '
                + '`{{replacement}}` instead — same arguments, idempotent. '
                + 'See eslint-config/plugin/rules/require-idempotent-migration.js.',
            deprecatedCreateTableIfNotExists:
                '`createTableIfNotExists` is not a safe way to make `createTable` idempotent — Knex '
                + 'itself warns against it, because it emits a bare CREATE TABLE IF NOT EXISTS and '
                + 'drops the follow-up ALTER statements it generates for some column types. Guard '
                + 'with `if (!(await knex.schema.withSchema(...).hasTable(name)))` around a plain '
                + '`createTable` instead.',
            needsProbe:
                '`{{method}}` fails if the migration is re-run after a partial failure, and Knex has '
                + 'no idempotent counterpart. Wrap it in a probe: '
                + '`if (!(await knex.schema.withSchema(\'<schema>\').hasTable(\'{{name}}\'))) { ... }`. '
                + 'See eslint-config/plugin/rules/require-idempotent-migration.js.',
            unguardedAlter:
                '`{{method}}(\'{{name}}\', ...)` adds or drops columns, indexes, or constraints, none '
                + 'of which Knex emits with an existence guard — re-running this migration after a '
                + 'partial failure throws. Either issue the change as raw SQL carrying its own guard '
                + '(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`), or probe first with '
                + '`await knex.schema.withSchema(\'<schema>\').hasColumn(\'{{name}}\', \'<column>\')`.',
            rawMissingGuard:
                'Raw `{{statement}}` has no `{{guard}}`, so re-running this migration after a partial '
                + 'failure throws. Add `{{guard}}`.',
            rawNeedsDropFirst:
                'Postgres has no `IF NOT EXISTS` for `{{statement}}`, so this migration cannot be '
                + 're-run after a partial failure. Issue `{{pairKeyword}} {{name}}` first, then create '
                + 'it — or wrap the whole thing in a `DO $$ ... $$` block that checks the catalog.',
            rawNeedsOrReplace:
                '`{{statement}}` throws when the object already exists. Use `{{replacement}}` so the '
                + 'migration re-applies cleanly.',
        },
    },

    create(context) {
        const since = (context.options[0] || {}).since;
        const filename = context.filename || context.getFilename();
        const basename = path.basename(filename || '');
        const timestampMatch = basename.match(MIGRATION_TIMESTAMP);

        // Exempt migrations that predate the cutoff. A file with no timestamp prefix is not
        // exempt — an off-convention filename must not double as a way around the gate.
        if (since && timestampMatch && timestampMatch[1] < since) {
            return {};
        }

        // Probes are collected across the whole file and resolved at Program:exit, because a
        // guard may be written after the statement it protects (an early-return, say).
        const probes = [];
        const pending = [];

        const defer = (descriptor) => pending.push(descriptor);

        const probeCovers = (candidate) => probes.some((probe) => {
            if (probe.scope !== candidate.scope) {
                return false;
            }
            // A probe naming the same table vouches for it. A probe whose target is a variable
            // (or a target we could not read statically) vouches for anything in its function.
            if (!probe.target || !candidate.name) {
                return true;
            }
            return probe.target === candidate.name;
        });

        // Raw SQL is gathered first and checked at Program:exit, because the drop-first idiom is
        // routinely split across two `knex.raw()` calls:
        //     await knex.raw('ALTER TABLE ... DROP CONSTRAINT IF EXISTS chk_x');
        //     await knex.raw('ALTER TABLE ... ADD CONSTRAINT chk_x CHECK (...)');
        // Pairing within a single literal would flag that, which is exactly the shape we want
        // people writing. Pairing is scoped to the enclosing migration function, so the
        // `DROP CONSTRAINT IF EXISTS` in `down` cannot vouch for the `ADD CONSTRAINT` in `up`.
        const sqlLiterals = [];

        const collectRawSql = (node) => {
            if (!node || (node.type !== 'Literal' && node.type !== 'TemplateLiteral')) {
                return;
            }
            const raw = literalSqlText(node);
            if (!raw) {
                return;
            }
            const sql = normaliseSql(raw);
            // A `DO $$ ... $$` block is Postgres' own conditional-DDL construct; writing one is an
            // explicit statement that the author handled repeatability.
            if (DO_BLOCK.test(sql)) {
                return;
            }
            sqlLiterals.push({ node, sql, scope: enclosingMigrationFunction(node) });
        };

        const checkRawSql = ({ node, sql, scope }, droppedByScope) => {
            const reported = new Set();
            const reportOnce = (key, descriptor) => {
                if (reported.has(key)) {
                    return;
                }
                reported.add(key);
                defer(descriptor);
            };

            RAW_INLINE_GUARD_RULES.forEach((rule) => {
                const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
                const match = regex.exec(sql);
                if (!match) {
                    return;
                }
                // For the DROP family the captured object type makes the message specific.
                const statement = match[1]
                    ? `${rule.statement} ${match[1].replace(/\s+/g, ' ').toUpperCase()}`
                    : rule.statement;
                reportOnce(`inline:${statement}`, {
                    node,
                    messageId: 'rawMissingGuard',
                    data: { statement, guard: rule.guard },
                });
            });

            RAW_DROP_FIRST_RULES.forEach((rule) => {
                const { byScope, shared } = droppedByScope.get(rule.statement);
                const dropped = byScope.get(scope) || shared;
                const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
                let match = regex.exec(sql);
                while (match) {
                    const name = match[1];
                    if (!dropped.has(name.toLowerCase())) {
                        reportOnce(`dropFirst:${rule.statement}:${name}`, {
                            node,
                            messageId: 'rawNeedsDropFirst',
                            data: { statement: rule.statement, pairKeyword: rule.pairKeyword, name },
                        });
                    }
                    match = regex.exec(sql);
                }
            });

            RAW_OR_REPLACE_RULES.forEach((rule) => {
                const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
                if (!regex.test(sql)) {
                    return;
                }
                reportOnce(`orReplace:${rule.statement}`, {
                    node,
                    messageId: 'rawNeedsOrReplace',
                    data: { statement: rule.statement, replacement: rule.replacement },
                });
            });
        };

        return {
            CallExpression(node) {
                const method = staticMethodName(node.callee);
                if (!method) {
                    return;
                }

                if (method === RAW_METHOD) {
                    node.arguments.forEach(collectRawSql);
                    return;
                }

                if (PROBE_METHODS.has(method)) {
                    probes.push({
                        scope: enclosingMigrationFunction(node),
                        target: stringArg(node, 0),
                    });
                    return;
                }

                if (method === 'createTableIfNotExists') {
                    defer({ node, messageId: 'deprecatedCreateTableIfNotExists' });
                    return;
                }

                if (DROP_IN_REPLACEMENTS[method]) {
                    defer({
                        node,
                        messageId: 'dropInReplacement',
                        data: { method, replacement: DROP_IN_REPLACEMENTS[method] },
                    });
                    return;
                }

                if (PROBE_REQUIRED_METHODS.has(method)) {
                    if (isConditionallyExecuted(node)) {
                        return;
                    }
                    defer({
                        node,
                        messageId: 'needsProbe',
                        data: { method, name: stringArg(node, 0) || '<table>' },
                        requiresProbe: true,
                        scope: enclosingMigrationFunction(node),
                        name: stringArg(node, 0),
                    });
                    return;
                }

                if (ALTER_TABLE_METHODS.has(method)) {
                    const callback = functionArg(node);
                    // `knex.table('users')` with no callback is a query builder, not schema DDL.
                    if (!callback || alterCallbackIsRepeatable(callback)) {
                        return;
                    }
                    if (isConditionallyExecuted(node)) {
                        return;
                    }
                    defer({
                        node,
                        messageId: 'unguardedAlter',
                        data: { method, name: stringArg(node, 0) || '<table>' },
                        requiresProbe: true,
                        scope: enclosingMigrationFunction(node),
                        name: stringArg(node, 0),
                    });
                }
            },

            // `const createIndexSql = \`CREATE INDEX ...\`;` handed to `knex.raw(createIndexSql)`
            // later is still raw DDL; the name is the only signal available without dataflow.
            VariableDeclarator(node) {
                if (node.id.type === 'Identifier' && SQL_VARIABLE_NAME.test(node.id.name)) {
                    collectRawSql(node.init);
                }
            },

            'Program:exit': () => {
                // For each drop-first rule: which object names does each migration function drop?
                // A literal outside any function (a module-level SQL constant) is filed under the
                // `null` scope and credited to every function, since it could be used by any.
                const droppedByScope = new Map(RAW_DROP_FIRST_RULES.map((rule) => {
                    const byScope = new Map();
                    const shared = new Set();
                    sqlLiterals.forEach(({ sql, scope }) => {
                        const target = scope === null ? shared : byScope.get(scope) || new Set();
                        collectNames(sql, rule.pairPattern).forEach((name) => target.add(name));
                        if (scope !== null) {
                            byScope.set(scope, target);
                        }
                    });
                    byScope.forEach((names) => shared.forEach((name) => names.add(name)));
                    return [rule.statement, { byScope, shared }];
                }));

                sqlLiterals.forEach((literal) => checkRawSql(literal, droppedByScope));

                pending.forEach((candidate) => {
                    if (candidate.requiresProbe && probeCovers(candidate)) {
                        return;
                    }
                    context.report({
                        node: candidate.node,
                        messageId: candidate.messageId,
                        data: candidate.data,
                    });
                });
            },
        };
    },
};
