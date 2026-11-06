// Tests for the pure half of scripts/retention-report — the parts that decide what the report is
// allowed to read and print. The SQL itself runs only against a real database; what is checked
// here is that it cannot write, cannot leak, and cannot quietly count internal accounts.
//
// Run: node scripts/retention-report/tests/retention-report.test.js (part of `npm run test:harness`).

const assert = require('assert');
const {
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
} = require('../index');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- read-only -------------------------------------------------------------

test('every section is a single read: no write or DDL keyword anywhere', () => {
    const writeKeyword = /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY)\b/i;
    SECTIONS.forEach((section) => {
        assert.ok(!writeKeyword.test(section.sql), `${section.key} contains a write keyword`);
    });
});

test('the connection is read-only before any statement runs', () => {
    const { config } = resolveConnection({
        DB_HOST_MAIN_READ: 'h', DB_USER_MAIN_READ: 'u', DB_PASSWORD_MAIN_READ: 'p', USERS_SERVICE_DATABASE: 'd',
    });
    assert.match(config.options, /default_transaction_read_only=on/);
});

test('prefers the READ replica and ignores WRITE credentials unless allowed', () => {
    const env = {
        DB_HOST_MAIN_WRITE: 'writer', DB_USER_MAIN_WRITE: 'wu', DB_PASSWORD_MAIN_WRITE: 'wp', USERS_SERVICE_DATABASE: 'd',
    };
    const refused = resolveConnection(env);
    assert.deepStrictEqual(refused.missing, ['DB_HOST_MAIN_READ', 'DB_USER_MAIN_READ', 'DB_PASSWORD_MAIN_READ']);

    const allowed = resolveConnection(env, { allowWriteCredentials: true });
    assert.deepStrictEqual(allowed.missing, []);
    assert.strictEqual(allowed.usesWriteCredentials, true);
    assert.strictEqual(allowed.config.host, 'writer');

    const both = resolveConnection({ ...env, DB_HOST_MAIN_READ: 'replica' }, { allowWriteCredentials: true });
    assert.strictEqual(both.config.host, 'replica');
});

// --- who is counted --------------------------------------------------------

test('the cohort excludes superusers, bots and test.local accounts', () => {
    assert.match(COHORT_SQL, /"isSuperUser"/);
    assert.match(COHORT_SQL, /"isBot"/);
    assert.match(COHORT_SQL, /user\.admin\.super/);
    assert.match(COHORT_SQL, /test\.local/);
});

test('every section counts from the shared cohort, so no section can include internal accounts alone', () => {
    SECTIONS.forEach((section) => {
        assert.ok(section.sql.includes(COHORT_SQL), `${section.key} does not use COHORT_SQL`);
    });
});

test('passes exactly the parameters each section references', () => {
    SECTIONS.forEach((section) => {
        const params = sectionParams(section, { days: 30 });
        const highest = Math.max(...[...section.sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
        assert.strictEqual(params.length, highest, `${section.key}: ${params.length} params for $${highest}`);
    });
    assert.deepStrictEqual(sectionParams({ sql: '$1 $2 $3' }, { days: 14, includeInternal: true }), ['habits', true, 14]);
});

// --- no PII ----------------------------------------------------------------

test('refuses identity-looking columns', () => {
    ['email', 'userName', 'phoneNumber', 'firstName', 'id', 'userId', 'claimToken'].forEach((column) => {
        assert.throws(() => assertNoPii('t', [{ [column]: 'x' }]), /identity field/, column);
    });
});

test('refuses values that look like an email address', () => {
    assert.throws(() => assertNoPii('t', [{ state: 'someone@example.com' }]), /email address/);
});

test('lets aggregates through', () => {
    const rows = [{ bucket: 'day 0', users_checking_in: 35, sent_per_user: 11.4 }];
    assert.strictEqual(assertNoPii('t', rows), rows);
});

// --- formatting and args ---------------------------------------------------

test('turns pg numeric strings back into numbers and leaves labels alone', () => {
    assert.deepStrictEqual(
        normalizeRow({
            users: '35', rate: '0.063', bucket: 'day 1-2', median: null,
        }),
        {
            users: 35, rate: 0.063, bucket: 'day 1-2', median: null,
        },
    );
});

test('renders a fixed-width table with a dash for nulls', () => {
    const text = renderTable([{ state: 'never', users: 12 }, { state: 'checked in <7d', users: null }]);
    const lines = text.split('\n');
    assert.strictEqual(lines.length, 4);
    assert.match(lines[0], /^state\s+users$/);
    assert.match(lines[3], /-$/);
    assert.strictEqual(renderTable([]), '(no rows)');
});

test('the report header says whether internal accounts were excluded', () => {
    const sections = [{ title: 'x', rows: [] }];
    assert.match(renderReport({ generatedAt: 'd', days: 30, sections }), /Excludes superusers/);
    assert.match(renderReport({
        generatedAt: 'd', days: 30, includeInternal: true, sections,
    }), /INCLUDES superusers/);
});

test('parses flags and rejects nonsense', () => {
    assert.deepStrictEqual(parseArgs([]), {
        days: 30, json: false, envFile: '', allowWriteCredentials: false, includeInternal: false,
    });
    const args = parseArgs(['--days', '14', '--json', '--env-file', 'x.env', '--allow-write-credentials', '--include-internal']);
    assert.strictEqual(args.days, 14);
    assert.strictEqual(args.json, true);
    assert.strictEqual(args.envFile, 'x.env');
    assert.strictEqual(args.allowWriteCredentials, true);
    assert.strictEqual(args.includeInternal, true);
    assert.throws(() => parseArgs(['--days', '0']), /--days/);
    assert.throws(() => parseArgs(['--days', 'abc']), /--days/);
    assert.throws(() => parseArgs(['--write']), /Unknown argument/);
});

test('reads KEY=value env files and strips quotes', () => {
    assert.deepStrictEqual(
        parseEnvFile('A=1\nB="two"\n# comment\nC=\'three\'\nnot a line'),
        { A: '1', B: 'two', C: 'three' },
    );
});

// ---------------------------------------------------------------------------

let failed = 0;
tests.forEach(({ name, fn }) => {
    try {
        fn();
        process.stdout.write(`ok - ${name}\n`);
    } catch (error) {
        failed += 1;
        process.stdout.write(`not ok - ${name}\n  ${error.message}\n`);
    }
});
process.stdout.write(`\n${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed ? 1 : 0);
