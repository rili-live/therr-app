#!/usr/bin/env node
/**
 * Read-only ad-hoc SQL against a production service database.
 *
 *   npm run db:query -- --sql 'SELECT COUNT(*) FROM main.subscribers'
 *   npm run db:query -- --db maps --file /path/to/query.sql
 *   echo 'SELECT 1' | npm run db:query -- --json
 *
 * Options:
 *   --sql <text>        the query (or --file <path>, or SQL on stdin)
 *   --db <service>      users (default) | maps | reactions | messages — reads <SERVICE>_SERVICE_DATABASE
 *   --env-file <path>   default scripts/import-spaces/.env (git-ignored; holds the prod credentials)
 *   --json              machine-readable rows
 *   --max-rows <n>      print at most n rows (default 200); the true row count is always reported
 *   --show-pii          print email addresses unmasked (default: local part masked, domain kept)
 *
 * SAFETY. This exists so a session never hand-rolls a throwaway `pg` script against production.
 * The connection starts with default_transaction_read_only=on, the session is set READ ONLY, and
 * the query runs inside BEGIN READ ONLY … ROLLBACK, so an INSERT/UPDATE/DDL fails in Postgres
 * (error 25006) even though the .env only carries the WRITE user. One statement per run: a
 * multi-statement string is refused, so nothing can slip a COMMIT between our BEGIN and ROLLBACK.
 *
 * Connection resolution (READ replica first, WRITE host as a forced-read-only fallback) and .env
 * parsing are shared with scripts/retention-report, so both scripts agree on what they connect to.
 */

const fs = require('fs');
const path = require('path');
const { parseEnvFile, resolveConnection } = require('../retention-report');

const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_ENV_FILE = path.join(REPO_ROOT, 'scripts/import-spaces/.env');
const DATABASES = ['users', 'maps', 'reactions', 'messages'];
const EMAIL_RE = /([^\s@"',;:<>()]+)@([^\s@"',;:<>()]+\.[^\s@"',;:<>()]+)/g;

const parseArgs = (argv) => {
    const args = {
        sql: '', file: '', db: 'users', envFile: DEFAULT_ENV_FILE, json: false, maxRows: 200, showPii: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--sql') {
            args.sql = argv[i += 1] || '';
        } else if (arg === '--file') {
            args.file = argv[i += 1] || '';
        } else if (arg === '--db') {
            args.db = argv[i += 1] || '';
        } else if (arg === '--env-file') {
            args.envFile = argv[i += 1] || '';
        } else if (arg === '--json') {
            args.json = true;
        } else if (arg === '--show-pii') {
            args.showPii = true;
        } else if (arg === '--max-rows') {
            args.maxRows = Number(argv[i += 1]);
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    if (!DATABASES.includes(args.db)) {
        throw new Error(`--db must be one of ${DATABASES.join(', ')}`);
    }
    if (!Number.isInteger(args.maxRows) || args.maxRows < 1) {
        throw new Error('--max-rows must be a positive integer');
    }
    return args;
};

/**
 * Refuses an empty string or more than one statement. Semicolons inside quotes, dollar quotes and
 * comments are ignored; a single trailing semicolon is allowed.
 */
const assertSingleStatement = (sql) => {
    const stripped = sql
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "''")
        .replace(/'(?:[^']|'')*'/g, "''")
        .replace(/"(?:[^"]|"")*"/g, '""')
        .trim()
        .replace(/;\s*$/, '');
    if (!stripped) {
        throw new Error('No SQL given. Pass --sql, --file, or pipe it on stdin.');
    }
    if (stripped.includes(';')) {
        throw new Error('One statement per run. Split the query, or use a CTE.');
    }
};

/** jane.doe@gmail.com -> j***@gmail.com. The domain is kept: it is what segments a list. */
const maskEmails = (value) => value.replace(EMAIL_RE, (_, local, domain) => `${local[0]}***@${domain}`);

const normalizeValue = (value, { showPii }) => {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'string') {
        return showPii ? value : maskEmails(value);
    }
    if (value && typeof value === 'object') {
        const text = JSON.stringify(value);
        return showPii ? text : maskEmails(text);
    }
    return value;
};

const renderTable = (rows) => {
    if (!rows.length) {
        return '(no rows)';
    }
    const columns = Object.keys(rows[0]);
    const cells = rows.map((row) => columns.map((col) => (row[col] === null || row[col] === undefined ? '' : String(row[col]))));
    const widths = columns.map((col, i) => Math.min(60, Math.max(col.length, ...cells.map((r) => r[i].length))));
    const fit = (text, width) => (text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width));
    return [
        columns.map((col, i) => fit(col, widths[i])).join(' | '),
        widths.map((w) => '-'.repeat(w)).join('-|-'),
        ...cells.map((r) => r.map((cell, i) => fit(cell, widths[i])).join(' | ')),
    ].join('\n');
};

const readSql = async (args) => {
    if (args.sql) {
        return args.sql;
    }
    if (args.file) {
        return fs.readFileSync(path.resolve(args.file), 'utf8');
    }
    if (process.stdin.isTTY) {
        return '';
    }
    const chunks = [];
    for await (const chunk of process.stdin) { // eslint-disable-line no-restricted-syntax
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        process.stdout.write(`${fs.readFileSync(__filename, 'utf8').split('*/')[0]}*/\n`);
        return;
    }
    const sql = await readSql(args);
    assertSingleStatement(sql);

    const env = { ...process.env, ...parseEnvFile(fs.readFileSync(path.resolve(args.envFile), 'utf8')) };
    const dbVar = `${args.db.toUpperCase()}_SERVICE_DATABASE`;
    const { missing, config } = resolveConnection({ ...env, USERS_SERVICE_DATABASE: env[dbVar] }, { allowWriteCredentials: true });
    if (missing.length) {
        throw new Error(`Missing in ${args.envFile}: ${missing.map((v) => (v === 'USERS_SERVICE_DATABASE' ? dbVar : v)).join(', ')}`);
    }

    const { Client, types } = require('pg'); // eslint-disable-line global-require
    // A DATE column would otherwise come back as local midnight and print as the previous day's UTC.
    types.setTypeParser(1082, (value) => value);
    const client = new Client({ ...config, application_name: 'therr-prod-query' });
    await client.connect();
    try {
        await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
        await client.query('BEGIN READ ONLY');
        let result;
        try {
            result = await client.query(sql);
        } finally {
            await client.query('ROLLBACK');
        }
        const rows = (result.rows || []).slice(0, args.maxRows).map((row) => Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, normalizeValue(value, args)]),
        ));
        const total = result.rowCount === null ? rows.length : result.rowCount;
        if (args.json) {
            process.stdout.write(`${JSON.stringify({ rowCount: total, rows }, null, 2)}\n`);
        } else {
            process.stdout.write(`${renderTable(rows)}\n(${total} row${total === 1 ? '' : 's'}`
                + `${total > rows.length ? `, first ${rows.length} shown` : ''})\n`);
        }
    } finally {
        await client.end();
    }
};

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`prod-query: ${error.message}\n`);
        process.exit(1);
    });
}

module.exports = {
    assertSingleStatement, maskEmails, normalizeValue, parseArgs, renderTable,
};
