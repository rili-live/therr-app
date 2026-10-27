// Require new Knex migrations to build and drop indexes CONCURRENTLY.
//
// Why this is an invariant and not a style preference:
//
// Migrations run at deploy time against the live production tables. A plain `CREATE INDEX`
// holds a SHARE lock on its table for the whole build, which blocks every INSERT, UPDATE and
// DELETE until it finishes; a plain `DROP INDEX` takes ACCESS EXCLUSIVE, which blocks reads
// too. On a production-sized table either one stalls live traffic for as long as it runs, and
// nothing in local dev or CI — where the tables are small — shows it. `CONCURRENTLY` builds
// and drops without blocking writes.
//
// CONCURRENTLY brings obligations of its own. Each one fails at deploy time, not at lint or
// compile time, so this rule checks them too:
//
//   1. It cannot run inside a transaction block (pg raises 25001), and knex wraps every
//      migration in one. The file must opt out with `exports.config = { transaction: false }`.
//      Its statements then no longer commit as a unit, so each must be idempotent on its own —
//      which therr/require-idempotent-migration already checks.
//
//   2. A concurrent build that fails (deadlock, cancelled session, a long transaction it cannot
//      wait out) leaves the index behind marked INVALID rather than removing it. `IF NOT EXISTS`
//      matches that index on the retry and skips the build, so the migration "succeeds" with an
//      index the planner never uses and nothing ever repairs. The migration must clear an
//      invalid index before creating it: probe `pg_index.indisvalid` (the narrow form — see
//      users-service 20260727000000_main.userInterests.affinityScore.js), or issue
//      `DROP INDEX CONCURRENTLY IF EXISTS <name>` first.
//
// Exempt: indexes on a table the same migration function creates. The table is empty and
// nothing reads it until the migration finishes, so the lock is instantaneous — and Knex's
// createTable builder cannot emit CONCURRENTLY anyway. That covers `table.index()` /
// `table.unique()` inside a `createTable` callback, and a raw `CREATE INDEX ... ON <table>`
// whose table the same function passes to `createTable` or `CREATE TABLE`.
//
// Scope: only migrations dated at or after the `since` cutoff configured in
// eslint-config/service.js — see eslint-config/migration-concurrent-index-cutoff.js. A file
// whose name carries no `YYYYMMDDHHMMSS` prefix is checked regardless.
//
// Escape hatch, for the genuinely exotic case:
//   // eslint-disable-next-line therr/require-concurrent-index -- <why>

const path = require('path');

const MIGRATION_TIMESTAMP = /^(\d{14})_/;

// Raw SQL is only inspected where it is unambiguously SQL — the same two places
// require-idempotent-migration looks: `.raw()` arguments and string constants named like SQL.
const RAW_METHOD = 'raw';
const SQL_VARIABLE_NAME = /(?:sql|ddl|query|statement|stmt)/i;

const SQL_LINE_COMMENT = /--[^\n]*/g;
const SQL_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

const IDENT = '"?([A-Za-z0-9_$]+)"?';
const QUALIFIED_IDENT = `(?:"?[A-Za-z0-9_$]+"?\\.)?${IDENT}`;

const CREATE_INDEX = /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi;
// Each of these is applied to the text starting at a CREATE INDEX match. They are separate
// rather than one pattern so an interpolated name or table (`${indexName}`) only loses that
// one part of the parse, instead of making the whole statement invisible.
const CREATE_INDEX_CONCURRENTLY = /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i;
const CREATE_INDEX_NAME = new RegExp(
    `^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?(?!ON\\s)${IDENT}\\s+ON\\b`,
    'i',
);
const CREATE_INDEX_TABLE = new RegExp(`\\bON\\s+(?:ONLY\\s+)?${QUALIFIED_IDENT}`, 'i');

const DROP_INDEX_NOT_CONCURRENT = /\bDROP\s+INDEX\b(?!\s+CONCURRENTLY\b)/i;
const DROP_INDEX_CONCURRENTLY_NAMES = new RegExp(`\\bDROP\\s+INDEX\\s+CONCURRENTLY\\s+IF\\s+EXISTS\\s+${QUALIFIED_IDENT}`, 'gi');

const CREATE_TABLE_NAMES = new RegExp(
    `\\bCREATE\\s+(?:(?:GLOBAL|LOCAL|TEMP|TEMPORARY|UNLOGGED)\\s+)*TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${QUALIFIED_IDENT}`,
    'gi',
);

// Statements that refuse to run inside a transaction block. REFRESH MATERIALIZED VIEW
// CONCURRENTLY is deliberately absent: it runs inside one without complaint.
const NEEDS_NO_TRANSACTION = /\b(?:CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+INDEX)\s+CONCURRENTLY\b|\bREINDEX\b[^;]*?\bCONCURRENTLY\b/i;

const INVALID_INDEX_PROBE = /\bindisvalid\b/i;

const ALTER_TABLE_METHODS = new Set(['alterTable', 'table']);
const CREATE_TABLE_METHODS = new Set(['createTable', 'createTableLike']);
const BUILDER_INDEX_METHODS = new Set(['index', 'unique', 'dropIndex', 'dropUnique']);

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

const isFunction = (node) => node && (node.type === 'ArrowFunctionExpression'
    || node.type === 'FunctionExpression'
    || node.type === 'FunctionDeclaration');

/**
 * The outermost enclosing function — `exports.up` / `exports.down` for anything inside them.
 * Scopes createTable/DROP pairing to one migration direction, so `down` cannot vouch for `up`.
 */
const enclosingMigrationFunction = (node) => {
    let outermost = null;
    let current = node.parent;
    while (current) {
        if (isFunction(current)) {
            outermost = current;
        }
        current = current.parent;
    }
    return outermost;
};

/** The schema-builder call (`alterTable`, `createTable`, ...) whose callback `node` sits in, if any. */
const enclosingBuilderMethod = (node) => {
    let current = node.parent;
    while (current) {
        if (isFunction(current) && current.parent && current.parent.type === 'CallExpression'
            && current.parent.arguments.includes(current)) {
            return staticMethodName(current.parent.callee);
        }
        current = current.parent;
    }
    return null;
};

/** Concatenated text of a string or template literal, with interpolations neutralised. */
const literalSqlText = (node) => {
    if (node.type === 'Literal') {
        return typeof node.value === 'string' ? node.value : null;
    }
    // Interpolated values become whitespace so they cannot fuse two keywords across the seam.
    return node.quasis.map((quasi) => quasi.value.cooked || '').join('   ');
};

const stripComments = (sql) => sql.replace(SQL_BLOCK_COMMENT, ' ').replace(SQL_LINE_COMMENT, ' ');

const collectNames = (sql, pattern, into) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match = regex.exec(sql);
    while (match) {
        into.add(match[1].toLowerCase());
        match = regex.exec(sql);
    }
};

const isPropertyNamed = (prop, name) => prop.type === 'Property'
    && ((prop.key.type === 'Identifier' && prop.key.name === name) || prop.key.value === name);

/** True for `{ transaction: false }`. */
const isTransactionFalse = (node) => node && node.type === 'ObjectExpression'
    && node.properties.some((prop) => isPropertyNamed(prop, 'transaction')
        && prop.value.type === 'Literal' && prop.value.value === false);

/** `module.exports` or `exports`. */
const isModuleExports = (node) => (node.type === 'Identifier' && node.name === 'exports')
    || (node.type === 'MemberExpression' && !node.computed && node.object.type === 'Identifier'
        && node.object.name === 'module' && node.property.name === 'exports');

/** `exports.config` or `module.exports.config`. */
const isExportsConfig = (node) => node.type === 'MemberExpression' && !node.computed
    && node.property.name === 'config' && isModuleExports(node.object);

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require Knex migrations to create and drop indexes CONCURRENTLY, with the transaction '
                + 'opt-out and invalid-index cleanup that CONCURRENTLY needs',
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
            createNotConcurrent:
                '`CREATE INDEX` without `CONCURRENTLY` locks the table against writes for the whole build — on a '
                + 'production table that stalls live traffic for the length of the deploy. Use '
                + '`CREATE INDEX CONCURRENTLY IF NOT EXISTS`, with `exports.config = { transaction: false }` and an '
                + 'invalid-index cleanup. See eslint-config/plugin/rules/require-concurrent-index.js.',
            dropNotConcurrent:
                '`DROP INDEX` without `CONCURRENTLY` takes ACCESS EXCLUSIVE on the table, blocking reads as well as '
                + 'writes. Use `DROP INDEX CONCURRENTLY IF EXISTS` (one index per statement), with '
                + '`exports.config = { transaction: false }`. If this function also drops the table, the separate '
                + 'DROP INDEX is redundant — remove it.',
            builderIndexOnExistingTable:
                '`{{method}}()` inside `{{builder}}()` changes an index on an existing table under a blocking lock, '
                + 'and Knex cannot emit CONCURRENTLY. Issue it as raw SQL — `CREATE [UNIQUE] INDEX CONCURRENTLY IF '
                + 'NOT EXISTS ...` / `DROP INDEX CONCURRENTLY IF EXISTS ...` — with '
                + '`exports.config = { transaction: false }`.',
            needsTransactionFalse:
                '`CONCURRENTLY` cannot run inside a transaction block (pg error 25001), and knex wraps every '
                + 'migration in one, so this fails at deploy time. Add `exports.config = { transaction: false };` '
                + '— and keep every statement in the file individually idempotent, since they no longer commit as '
                + 'a unit.',
            needsInvalidIndexCleanup:
                'A failed concurrent build leaves `{{name}}` behind marked INVALID, and `IF NOT EXISTS` then skips '
                + 'it on the retry — the migration succeeds with an index the planner never uses. Clear an invalid '
                + 'one before creating it: probe `pg_index.indisvalid` (see users-service '
                + '20260727000000_main.userInterests.affinityScore.js), or issue '
                + '`DROP INDEX CONCURRENTLY IF EXISTS {{name}}` first.',
        },
    },

    create(context) {
        const { since } = context.options[0] || {};
        const filename = context.filename || context.getFilename();
        const timestampMatch = path.basename(filename || '').match(MIGRATION_TIMESTAMP);

        // Exempt migrations that predate the cutoff. A file with no timestamp prefix is not
        // exempt — an off-convention filename must not double as a way around the gate.
        if (since && timestampMatch && timestampMatch[1] < since) {
            return {};
        }

        // Everything is resolved at Program:exit: `exports.config` is often written below the
        // migration it governs, and a table's createTable can follow the raw SQL that indexes it
        // in source order (a module-level SQL constant, say).
        const sqlLiterals = [];
        const builderIndexCalls = [];
        const createdTablesByScope = new Map();
        let hasTransactionOptOut = false;

        const tablesCreatedIn = (scope) => {
            if (!createdTablesByScope.has(scope)) {
                createdTablesByScope.set(scope, new Set());
            }
            return createdTablesByScope.get(scope);
        };

        const collectRawSql = (node) => {
            if (!node || (node.type !== 'Literal' && node.type !== 'TemplateLiteral')) {
                return;
            }
            const raw = literalSqlText(node);
            if (!raw) {
                return;
            }
            const sql = stripComments(raw);
            const scope = enclosingMigrationFunction(node);
            collectNames(sql, CREATE_TABLE_NAMES, tablesCreatedIn(scope));
            sqlLiterals.push({ node, sql, scope });
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

                if (CREATE_TABLE_METHODS.has(method)) {
                    const name = stringArg(node, 0);
                    if (name) {
                        tablesCreatedIn(enclosingMigrationFunction(node)).add(name.toLowerCase());
                    }
                    return;
                }

                if (BUILDER_INDEX_METHODS.has(method)) {
                    const builder = enclosingBuilderMethod(node);
                    if (ALTER_TABLE_METHODS.has(builder)) {
                        builderIndexCalls.push({ node, method, builder });
                    }
                }
            },

            VariableDeclarator(node) {
                if (node.id.type === 'Identifier' && SQL_VARIABLE_NAME.test(node.id.name)) {
                    collectRawSql(node.init);
                }
            },

            AssignmentExpression(node) {
                if (isExportsConfig(node.left) && isTransactionFalse(node.right)) {
                    hasTransactionOptOut = true;
                }
                // `module.exports = { up, down, config: { transaction: false } }`
                if (isModuleExports(node.left) && node.right.type === 'ObjectExpression'
                    && node.right.properties.some((prop) => isPropertyNamed(prop, 'config') && isTransactionFalse(prop.value))) {
                    hasTransactionOptOut = true;
                }
            },

            'Program:exit': () => {
                // A module-level literal (scope null) could be used by any function, so what it
                // creates or drops is credited to all of them.
                const createdIn = (scope) => new Set([...tablesCreatedIn(scope), ...tablesCreatedIn(null)]);

                const droppedConcurrently = new Map();
                sqlLiterals.forEach(({ sql, scope }) => {
                    if (!droppedConcurrently.has(scope)) {
                        droppedConcurrently.set(scope, new Set());
                    }
                    collectNames(sql, DROP_INDEX_CONCURRENTLY_NAMES, droppedConcurrently.get(scope));
                });
                const droppedIn = (scope) => new Set([
                    ...(droppedConcurrently.get(scope) || []),
                    ...(droppedConcurrently.get(null) || []),
                ]);

                // The indisvalid probe is usually a module-level helper called from `up`, so it is
                // credited file-wide rather than per function.
                const probesInvalidIndexes = sqlLiterals.some(({ sql }) => INVALID_INDEX_PROBE.test(sql));

                let reportedTransaction = false;

                sqlLiterals.forEach(({ node, sql, scope }) => {
                    const reported = new Set();
                    const reportOnce = (key, descriptor) => {
                        if (!reported.has(key)) {
                            reported.add(key);
                            context.report({ node, ...descriptor });
                        }
                    };

                    const regex = new RegExp(CREATE_INDEX.source, CREATE_INDEX.flags);
                    let match = regex.exec(sql);
                    while (match) {
                        const statement = sql.slice(match.index);
                        const tableMatch = statement.match(CREATE_INDEX_TABLE);
                        const table = tableMatch ? tableMatch[1].toLowerCase() : null;
                        const nameMatch = statement.match(CREATE_INDEX_NAME);
                        const name = nameMatch ? nameMatch[1] : null;

                        if (!CREATE_INDEX_CONCURRENTLY.test(statement)) {
                            if (!table || !createdIn(scope).has(table)) {
                                reportOnce(`create:${name}`, { messageId: 'createNotConcurrent' });
                            }
                        } else if (!probesInvalidIndexes && !(name && droppedIn(scope).has(name.toLowerCase()))) {
                            reportOnce(`invalid:${name}`, {
                                messageId: 'needsInvalidIndexCleanup',
                                data: { name: name || '<index>' },
                            });
                        }
                        match = regex.exec(sql);
                    }

                    if (DROP_INDEX_NOT_CONCURRENT.test(sql)) {
                        reportOnce('drop', { messageId: 'dropNotConcurrent' });
                    }

                    if (!hasTransactionOptOut && !reportedTransaction && NEEDS_NO_TRANSACTION.test(sql)) {
                        reportedTransaction = true;
                        context.report({ node, messageId: 'needsTransactionFalse' });
                    }
                });

                builderIndexCalls.forEach(({ node, method, builder }) => {
                    context.report({ node, messageId: 'builderIndexOnExistingTable', data: { method, builder } });
                });
            },
        };
    },
};
