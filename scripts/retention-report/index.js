#!/usr/bin/env node
/**
 * Friends with Habits retention report — read-only, aggregate-only.
 *
 * Reproduces the product-DB numbers the 2026-10-28 retention review was built on, so they can be
 * re-read every week instead of re-derived by hand:
 *
 *   1. Activation          accounts, and how many >35 days old never completed a check-in
 *   2. Check-in curve      users checking in, by days since their own first check-in
 *   3. Paired vs unpaired  users whose partner joined vs invited-but-nobody-joined, at week 1 and 4
 *   4. Pact outcomes       pacts by status, and how many expired pacts were renewed
 *   5. Invite -> join      how fast invited partners join, and how many invites are still pending
 *   6. Push by state       habits pushes by the recipient's state at send time: sent/failed/opened
 *
 * USAGE (from the repo root)
 *
 *   node scripts/retention-report/index.js [--days 30] [--json] [--env-file <path>]
 *                                          [--allow-write-credentials] [--include-internal]
 *
 *   --days              push window for section 6 (default 30)
 *   --include-internal  count superusers, bots and test.local accounts too — only for reconciling
 *                       with a figure someone computed without the exclusion
 *
 *   npm run report:retention -- --env-file <path-to-.env>
 *
 * CREDENTIALS. Reads the users-service READ replica variables (DB_HOST_MAIN_READ,
 * DB_PORT_MAIN_READ, DB_USER_MAIN_READ, DB_PASSWORD_MAIN_READ, USERS_SERVICE_DATABASE) from the
 * environment, optionally loaded from --env-file. If only the WRITE variables are available
 * (scripts/import-spaces/.env holds those), pass --allow-write-credentials to use them; the
 * session is forced read-only either way, so that flag changes which host is read, never what
 * the report can do.
 *
 * READ-ONLY, THREE TIMES OVER. The connection starts with default_transaction_read_only=on, the
 * session is set READ ONLY, and every query runs inside BEGIN READ ONLY ... ROLLBACK. There is no
 * write path; do not add one.
 *
 * NO PII. Every query returns aggregates only. `assertNoPii` refuses to print a result whose
 * column names look like identity fields or whose values look like an email address, so a query
 * edited to return rows fails loudly instead of leaking them into a terminal or a PR.
 *
 * WHO IS COUNTED. Accounts enrolled in the habits brand (main.users."brandVariations"), minus
 * superusers ("isSuperUser" or the user.admin.super access level), bots ("isBot") and test
 * accounts (an email ending in test.local). See COHORT_SQL.
 *
 * Tests: node scripts/retention-report/tests/retention-report.test.js (part of `npm run test:harness`).
 */

const fs = require('fs');
const path = require('path');

const BRAND = 'habits';

// One definition of "a real Friends with Habits account", shared by every section so the
// sections cannot drift apart on who they count.
const COHORT_SQL = `
    SELECT u.id, u."createdAt", u."lastLoginAt"
    FROM main.users u
    WHERE u."brandVariations" @> jsonb_build_array(jsonb_build_object('brand', $1::text))
      AND ($2::boolean OR NOT (
          COALESCE(u."isSuperUser", false)
          OR COALESCE(u."isBot", false)
          OR u."accessLevels" ? 'user.admin.super'
          OR COALESCE(u.email, '') ILIKE '%test.local'
      ))
`;

// A completed check-in's calendar day. localDate is the user's own day (added 2026-09-13 and
// backfilled); scheduledDate is the fallback for any row it does not cover.
const CHECKIN_DAYS_SQL = `
    SELECT DISTINCT c."userId", COALESCE(c."localDate", c."scheduledDate") AS d
    FROM habits.habit_checkins c
    JOIN cohort ON cohort.id = c."userId"
    WHERE c.status = 'completed'
`;

const SECTIONS = [
    {
        key: 'activation',
        title: '1. Activation',
        sql: `
            WITH cohort AS (${COHORT_SQL}),
            checked_in AS (
                SELECT DISTINCT c."userId" FROM habits.habit_checkins c
                JOIN cohort ON cohort.id = c."userId" WHERE c.status = 'completed'
            )
            SELECT
                (SELECT count(*) FROM cohort) AS accounts,
                (SELECT count(*) FROM main.users u
                    WHERE u."brandVariations" @> jsonb_build_array(jsonb_build_object('brand', $1::text)))
                    - (SELECT count(*) FROM cohort) AS internal_excluded,
                (SELECT count(*) FROM cohort WHERE "createdAt" > now() - interval '30 days') AS new_last_30d,
                (SELECT count(*) FROM cohort WHERE "createdAt" < now() - interval '35 days') AS older_than_35d,
                (SELECT count(*) FROM cohort
                    WHERE "createdAt" < now() - interval '35 days'
                      AND id NOT IN (SELECT "userId" FROM checked_in)) AS older_than_35d_never_checked_in,
                (SELECT count(*) FROM checked_in) AS ever_checked_in,
                (SELECT count(*) FROM habits.habit_checkins c JOIN cohort ON cohort.id = c."userId"
                    WHERE c.status = 'completed') AS completed_checkins
        `,
    },
    {
        key: 'checkinCurve',
        title: '2. Check-in curve (users checking in, by days since their first check-in)',
        note: '`eligible` = users whose first check-in was long enough ago to reach the bucket, so recent '
            + 'starters do not read as churn.',
        sql: `
            WITH cohort AS (${COHORT_SQL}),
            days AS (${CHECKIN_DAYS_SQL}),
            firsts AS (SELECT "userId", min(d) AS first_day FROM days GROUP BY "userId"),
            offsets AS (
                SELECT days."userId", (days.d - firsts.first_day) AS day_offset
                FROM days JOIN firsts USING ("userId")
            ),
            buckets(bucket, lo, hi, ord) AS (VALUES
                ('day 0', 0, 0, 1), ('day 1-2', 1, 2, 2), ('day 3-6', 3, 6, 3),
                ('day 7-13', 7, 13, 4), ('day 14-29', 14, 29, 5), ('day 30+', 30, 1000000, 6)
            )
            SELECT b.bucket,
                   (SELECT count(*) FROM firsts f WHERE f.first_day <= CURRENT_DATE - b.lo) AS eligible,
                   count(DISTINCT o."userId") AS users_checking_in,
                   count(o."userId") AS user_days
            FROM buckets b
            LEFT JOIN offsets o ON o.day_offset BETWEEN b.lo AND b.hi
            GROUP BY b.bucket, b.ord, b.lo
            ORDER BY b.ord
        `,
    },
    {
        key: 'pairing',
        title: '3. Paired vs unpaired retention',
        note: '`paired` = a member of a pact where someone else also joined. `invited, nobody joined` = '
            + 'created a pact with a partner invite that no one ever accepted. Week 1 / week 4 = checked '
            + 'in 7+ / 28+ days after their own first check-in.',
        sql: `
            WITH cohort AS (${COHORT_SQL}),
            joined AS (
                SELECT pm."pactId", pm."userId" FROM habits.pact_members pm
                JOIN habits.pacts p ON p.id = pm."pactId"
                WHERE pm."joinedAt" IS NOT NULL AND NOT p."isSolo"
            ),
            paired AS (
                SELECT DISTINCT a."userId" FROM joined a
                JOIN joined b ON b."pactId" = a."pactId" AND b."userId" <> a."userId"
                JOIN cohort ON cohort.id = a."userId"
            ),
            invited_unpaired AS (
                SELECT DISTINCT p."creatorUserId" AS "userId" FROM habits.pacts p
                JOIN habits.pact_members pm ON pm."pactId" = p.id AND pm.role = 'partner'
                JOIN cohort ON cohort.id = p."creatorUserId"
                WHERE NOT p."isSolo" AND p."creatorUserId" NOT IN (SELECT "userId" FROM paired)
            ),
            grouped AS (
                SELECT 'paired' AS grp, "userId" FROM paired
                UNION ALL SELECT 'invited, nobody joined', "userId" FROM invited_unpaired
            ),
            days AS (${CHECKIN_DAYS_SQL}),
            per_user AS (
                SELECT "userId", count(*) AS checkin_days, max(d) - min(d) AS span_days
                FROM days GROUP BY "userId"
            )
            SELECT g.grp AS "group",
                   count(*) AS users,
                   count(pu."userId") AS checked_in,
                   round(avg(pu.checkin_days), 1) AS avg_checkin_days_of_checked_in,
                   count(*) FILTER (WHERE pu.span_days >= 7) AS still_checking_in_week_1,
                   count(*) FILTER (WHERE pu.span_days >= 28) AS still_checking_in_week_4
            FROM grouped g
            LEFT JOIN per_user pu ON pu."userId" = g."userId"
            GROUP BY g.grp
            ORDER BY g.grp DESC
        `,
    },
    {
        key: 'pacts',
        title: '4. Pact outcomes',
        note: 'renewal_rate = renewals / expired pacts.',
        sql: `
            WITH cohort AS (${COHORT_SQL}),
            pacts AS (SELECT p.* FROM habits.pacts p JOIN cohort ON cohort.id = p."creatorUserId")
            SELECT count(*) AS pacts,
                   count(*) FILTER (WHERE "isSolo") AS solo,
                   count(*) FILTER (WHERE status = 'pending') AS pending,
                   count(*) FILTER (WHERE status = 'active') AS active,
                   count(*) FILTER (WHERE status = 'expired') AS expired,
                   count(*) FILTER (WHERE status = 'abandoned') AS abandoned,
                   count(*) FILTER (WHERE "renewedFromPactId" IS NOT NULL) AS renewals,
                   round(count(*) FILTER (WHERE "renewedFromPactId" IS NOT NULL)::numeric
                         / NULLIF(count(*) FILTER (WHERE status = 'expired'), 0), 3) AS renewal_rate
            FROM pacts
        `,
    },
    {
        key: 'invites',
        title: '5. Partner invite -> join',
        sql: `
            WITH cohort AS (${COHORT_SQL}),
            invites AS (
                SELECT pm.*, invitee."lastLoginAt" AS invitee_last_login
                FROM habits.pact_members pm
                JOIN habits.pacts p ON p.id = pm."pactId"
                JOIN cohort ON cohort.id = p."creatorUserId"
                LEFT JOIN main.users invitee ON invitee.id = pm."userId"
                WHERE pm.role = 'partner'
            ),
            joined AS (
                SELECT extract(epoch FROM ("joinedAt" - "invitedAt")) / 60.0 AS minutes
                FROM invites WHERE "joinedAt" IS NOT NULL AND "invitedAt" IS NOT NULL
            )
            SELECT (SELECT count(*) FROM invites) AS partner_invites,
                   (SELECT count(*) FROM joined) AS joined,
                   (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes)::numeric, 1) FROM joined)
                       AS median_minutes_to_join,
                   (SELECT count(*) FROM joined WHERE minutes <= 60 * 24) AS joined_within_24h,
                   (SELECT count(*) FROM invites WHERE status = 'pending') AS still_pending,
                   (SELECT count(*) FROM invites
                       WHERE status = 'pending' AND invitee_last_login > "invitedAt") AS pending_invitee_opened_app_since
        `,
    },
    {
        key: 'pushByState',
        title: '6. Habits pushes by recipient state at send time',
        note: 'State is the recipient\'s last completed check-in before the row was queued. `opened` is '
            + 'only recorded from 2026-10-16 (main."notificationQueue"."openedAt").',
        sql: `
            WITH cohort AS (${COHORT_SQL}),
            q AS (
                SELECT n."userId", n.status, n."openedAt", n."createdAt",
                       (SELECT max(COALESCE(c."completedAt", c."createdAt")) FROM habits.habit_checkins c
                         WHERE c."userId" = n."userId" AND c.status = 'completed'
                           AND COALESCE(c."completedAt", c."createdAt") <= n."createdAt") AS last_checkin
                FROM main."notificationQueue" n
                JOIN cohort ON cohort.id = n."userId"
                WHERE n."brandVariation" = $1::text
                  AND n."createdAt" >= now() - make_interval(days => $3::int)
            ),
            stated AS (
                SELECT *,
                    CASE
                        WHEN last_checkin IS NULL THEN 'never checked in'
                        WHEN "createdAt" - last_checkin < interval '7 days' THEN 'checked in <7d'
                        WHEN "createdAt" - last_checkin < interval '30 days' THEN 'last check-in 7-30d'
                        ELSE 'last check-in >30d'
                    END AS state,
                    CASE
                        WHEN last_checkin IS NULL THEN 4
                        WHEN "createdAt" - last_checkin < interval '7 days' THEN 1
                        WHEN "createdAt" - last_checkin < interval '30 days' THEN 2
                        ELSE 3
                    END AS ord
                FROM q
            )
            SELECT state,
                   count(DISTINCT "userId") AS users,
                   count(*) AS queued,
                   count(*) FILTER (WHERE status = 'sent') AS sent,
                   count(*) FILTER (WHERE status = 'failed') AS failed,
                   count(*) FILTER (WHERE status = 'skipped') AS skipped,
                   count("openedAt") AS opened,
                   round(count(*) FILTER (WHERE status = 'sent')::numeric / NULLIF(count(DISTINCT "userId"), 0), 1)
                       AS sent_per_user
            FROM stated
            GROUP BY state, ord
            ORDER BY ord
        `,
    },
];

// ---------------------------------------------------------------------------
// Pure helpers (unit tested)
// ---------------------------------------------------------------------------

const PII_COLUMN_RE = /(email|phone|username|user_name|firstname|first_name|lastname|last_name|password|token|^id$|userid|user_id)/i;
const EMAIL_VALUE_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Throws when a result could carry personal data. Aggregates only, by construction and by check. */
const assertNoPii = (sectionKey, rows) => {
    rows.forEach((row) => {
        Object.entries(row).forEach(([column, value]) => {
            if (PII_COLUMN_RE.test(column)) {
                throw new Error(`[${sectionKey}] refusing to print column "${column}": it looks like an identity field`);
            }
            if (typeof value === 'string' && EMAIL_VALUE_RE.test(value)) {
                throw new Error(`[${sectionKey}] refusing to print a value that looks like an email address`);
            }
        });
    });
    return rows;
};

/** pg returns bigint/numeric as strings; turn the numeric-looking ones back into numbers. */
const normalizeRow = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
        return [key, Number(value)];
    }
    return [key, value];
}));

const formatCell = (value) => (value === null || value === undefined ? '-' : String(value));

/** A plain fixed-width table, readable in a terminal and pasteable into a PR. */
const renderTable = (rows) => {
    if (!rows.length) {
        return '(no rows)';
    }
    const columns = Object.keys(rows[0]);
    const widths = columns.map((column) => Math.max(
        column.length,
        ...rows.map((row) => formatCell(row[column]).length),
    ));
    const line = (cells) => cells.map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  ');

    return [
        line(columns),
        line(widths.map((width) => '-'.repeat(width))),
        ...rows.map((row) => line(columns.map((column) => formatCell(row[column])))),
    ].join('\n');
};

/**
 * Postgres cannot infer the type of a parameter the statement never references, so each section
 * gets exactly the parameters it uses: $1 brand, $2 include-internal, $3 days.
 */
const sectionParams = (section, { days, includeInternal = false }) => {
    const params = [BRAND, includeInternal];
    if (section.sql.includes('$3')) {
        params.push(days);
    }
    return params;
};

const renderReport = ({
    generatedAt, days, includeInternal = false, sections,
}) => [
    `Friends with Habits retention report — ${generatedAt} (push window: last ${days} days)`,
    includeInternal
        ? 'INCLUDES superusers, bots and test.local accounts (--include-internal). Aggregates only.'
        : 'Excludes superusers, bots and test.local accounts. Aggregates only.',
    ...sections.map((section) => [
        '',
        section.title,
        ...(section.note ? [section.note] : []),
        renderTable(section.rows),
    ].join('\n')),
].join('\n');

const parseArgs = (argv) => {
    const args = {
        days: 30, json: false, envFile: '', allowWriteCredentials: false, includeInternal: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--json') {
            args.json = true;
        } else if (arg === '--include-internal') {
            args.includeInternal = true;
        } else if (arg === '--allow-write-credentials') {
            args.allowWriteCredentials = true;
        } else if (arg === '--days') {
            args.days = Number(argv[i += 1]);
        } else if (arg === '--env-file') {
            args.envFile = argv[i += 1] || '';
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    if (!Number.isInteger(args.days) || args.days < 1 || args.days > 365) {
        throw new Error('--days must be an integer between 1 and 365');
    }
    return args;
};

/** KEY=value lines; quotes stripped. Values are never logged. */
const parseEnvFile = (text) => {
    const env = {};
    text.split('\n').forEach((line) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match) {
            env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        }
    });
    return env;
};

/**
 * Connection settings: the READ replica by default, the WRITE host only when explicitly allowed.
 * Returns the variable names that are missing rather than a half-built config.
 */
const resolveConnection = (env, { allowWriteCredentials = false } = {}) => {
    const pick = (suffix) => {
        const read = env[`DB_${suffix}_MAIN_READ`];
        if (read) {
            return { value: read, source: 'read' };
        }
        const write = allowWriteCredentials ? env[`DB_${suffix}_MAIN_WRITE`] : undefined;
        return write ? { value: write, source: 'write' } : { value: undefined, source: 'missing' };
    };
    const host = pick('HOST');
    const user = pick('USER');
    const password = pick('PASSWORD');
    const port = pick('PORT');
    const database = env.USERS_SERVICE_DATABASE;
    const missing = [
        !host.value && 'DB_HOST_MAIN_READ',
        !user.value && 'DB_USER_MAIN_READ',
        !password.value && 'DB_PASSWORD_MAIN_READ',
        !database && 'USERS_SERVICE_DATABASE',
    ].filter(Boolean);

    return {
        missing,
        usesWriteCredentials: [host, user, password].some((field) => field.source === 'write'),
        config: {
            host: host.value,
            user: user.value,
            password: password.value,
            port: Number(port.value || 5432),
            database,
            connectionTimeoutMillis: 10000,
            statement_timeout: 60000,
            // Read-only from the first statement, before any of ours runs.
            options: '-c default_transaction_read_only=on',
            application_name: 'therr-retention-report',
        },
    };
};

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

const runSections = async (client, { days, includeInternal }) => {
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    await client.query('BEGIN READ ONLY');
    try {
        const results = [];
        // Sequential on purpose: one transaction, one snapshot-consistent read per section.
        for (const section of SECTIONS) {
            const params = sectionParams(section, { days, includeInternal });
            const { rows } = await client.query(section.sql, params); // eslint-disable-line no-await-in-loop
            results.push({
                key: section.key,
                title: section.title,
                note: section.note,
                rows: assertNoPii(section.key, rows.map(normalizeRow)),
            });
        }
        return results;
    } finally {
        await client.query('ROLLBACK');
    }
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        process.stdout.write(`${fs.readFileSync(__filename, 'utf8').split('*/')[0]}*/\n`);
        return;
    }

    const env = { ...process.env };
    if (args.envFile) {
        Object.assign(env, parseEnvFile(fs.readFileSync(path.resolve(args.envFile), 'utf8')));
    }
    const { missing, usesWriteCredentials, config } = resolveConnection(env, args);
    if (missing.length) {
        throw new Error(`Missing env vars: ${missing.join(', ')}. Pass --env-file, or --allow-write-credentials `
            + 'to fall back to the DB_*_MAIN_WRITE variables (the session is read-only either way).');
    }
    if (usesWriteCredentials) {
        process.stderr.write('note: using DB_*_MAIN_WRITE credentials; the session is forced read-only.\n');
    }

    // Resolved from the repo root's node_modules, like the other scripts here. Required lazily:
    // the CI job that runs `test:harness` has no `npm ci`, and the tests load this module.
    const { Client } = require('pg'); // eslint-disable-line global-require
    const client = new Client(config);
    await client.connect();
    try {
        const sections = await runSections(client, { days: args.days, includeInternal: args.includeInternal });
        const report = {
            generatedAt: new Date().toISOString().slice(0, 10),
            days: args.days,
            includeInternal: args.includeInternal,
            sections,
        };
        process.stdout.write(args.json
            ? `${JSON.stringify(report, null, 2)}\n`
            : `${renderReport(report)}\n`);
    } finally {
        await client.end();
    }
};

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`retention-report: ${error.message}\n`);
        process.exit(1);
    });
}

module.exports = {
    COHORT_SQL,
    SECTIONS,
    assertNoPii,
    normalizeRow,
    parseArgs,
    parseEnvFile,
    renderReport,
    renderTable,
    resolveConnection,
    sectionParams,
};
