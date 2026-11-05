// Tests for the pure half of scripts/prod-query — the guards that stand between an ad-hoc query and
// production. The read-only transaction is Postgres's job; what is checked here is that a second
// statement cannot ride along (it could COMMIT the read-only transaction and start a writable one),
// and that email addresses are masked unless asked for.
//
// Run: node scripts/prod-query/tests/prod-query.test.js (part of `npm run test:harness`).

const assert = require('assert');
const {
    assertSingleStatement, maskEmails, normalizeValue, parseArgs, renderTable,
} = require('../index');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- one statement only ----------------------------------------------------

test('a single statement passes, with or without a trailing semicolon', () => {
    assertSingleStatement('SELECT 1');
    assertSingleStatement('SELECT 1;  \n');
});

test('a second statement is refused, including one that would COMMIT', () => {
    assert.throws(() => assertSingleStatement('SELECT 1; DELETE FROM main.users'), /One statement/);
    assert.throws(() => assertSingleStatement('COMMIT; UPDATE main.users SET email = null'), /One statement/);
});

test('semicolons inside literals, identifiers, dollar quotes and comments are not statement breaks', () => {
    assertSingleStatement("SELECT ';' AS a, \"we;ird\" FROM t -- trailing; comment\n");
    assertSingleStatement('SELECT $$a;b$$, $tag$c;d$tag$ /* x; y */');
    assertSingleStatement("SELECT 'it''s; fine'");
});

test('empty input is refused', () => {
    assert.throws(() => assertSingleStatement('  -- only a comment\n'), /No SQL/);
});

// --- PII --------------------------------------------------------------------

test('emails are masked to first letter + domain, anywhere in a string', () => {
    assert.strictEqual(maskEmails('jane.doe@gmail.com'), 'j***@gmail.com');
    assert.strictEqual(maskEmails('a: bob@x.io, c@y.co.uk'), 'a: b***@x.io, c***@y.co.uk');
});

test('JSON values are masked too, and --show-pii turns masking off', () => {
    assert.strictEqual(normalizeValue({ e: 'sam@ex.com' }, { showPii: false }), '{"e":"s***@ex.com"}');
    assert.strictEqual(normalizeValue('sam@ex.com', { showPii: true }), 'sam@ex.com');
    assert.strictEqual(normalizeValue(3, { showPii: false }), 3);
});

// --- args and rendering ----------------------------------------------------

test('parseArgs defaults to the users database and rejects an unknown one', () => {
    assert.strictEqual(parseArgs([]).db, 'users');
    assert.strictEqual(parseArgs(['--db', 'maps']).db, 'maps');
    assert.throws(() => parseArgs(['--db', 'prod']), /--db must be one of/);
    assert.throws(() => parseArgs(['--max-rows', '0']), /--max-rows/);
    assert.throws(() => parseArgs(['--write']), /Unknown argument/);
});

test('renderTable prints a header and a no-rows marker', () => {
    assert.strictEqual(renderTable([]), '(no rows)');
    assert.ok(renderTable([{ a: 1, b: null }]).startsWith('a | b'));
});

let failed = 0;
tests.forEach(({ name, fn }) => {
    try {
        fn();
        process.stdout.write(`  ok  ${name}\n`);
    } catch (error) {
        failed += 1;
        process.stdout.write(`  FAIL ${name}\n       ${error.message}\n`);
    }
});
process.stdout.write(`prod-query: ${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed ? 1 : 0);
