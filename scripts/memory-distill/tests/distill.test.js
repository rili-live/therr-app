// Tests for the memory-distill aggregator.
//
// The report is only useful if its strongest signal, "the same failure in two
// sessions", is right in both directions: one session's failure must not be
// reported as a repeat (noise trains people to ignore the report), and two
// sessions' must be (the point of the whole loop). The rest checks the window,
// the CI-line contract with the steward skill, and the already-promoted check.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    distill, renderMarkdown, markRun, promotedIn,
} = require('../index');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const fixture = (files) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'distill-'));
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), typeof body === 'string' ? body : JSON.stringify(body));
    }
    return root;
};

const digest = (id, day, errors = [], extra = {}) => ({
    version: 1, sessionId: id, startedAt: `${day}T10:00:00Z`, endedAt: `${day}T11:00:00Z`, errors, ...extra,
});
const err = (signature, extra = {}) => ({
    tool: 'Bash', input: 'npm test', error: 'Cannot find module', signature, ...extra,
});

const NOW = new Date('2026-10-28T12:00:00Z');

test('a signature seen in two sessions is a repeat; one seen twice in one session is not', () => {
    const root = fixture({
        'context/transcripts/digests/a.json': digest('a', '2026-10-20', [err('Bash: Cannot find module <q>'), err('Bash: once only'), err('Bash: once only')]),
        'context/transcripts/digests/b.json': digest('b', '2026-10-22', [err('Bash: Cannot find module <q>', { resolvedBy: 'npm run build' })]),
    });
    const r = distill({ root, since: '2026-10-01', now: NOW });
    assert.strictEqual(r.repeats.length, 1);
    assert.strictEqual(r.repeats[0].sessions, 2);
    assert.deepStrictEqual(r.repeats[0].resolvedBy, ['npm run build']);
    assert.deepStrictEqual(r.repeats[0].dates, ['2026-10-20', '2026-10-22']);
});

test('the window excludes older digests and logs, and defaults to the last run', () => {
    const root = fixture({
        'context/transcripts/digests/old.json': digest('old', '2026-09-01', [err('x')]),
        'context/transcripts/digests/new.json': digest('new', '2026-10-25', [err('x')]),
        'context/memory/2026-09-01.md': '- Gotcha: old lesson that is long enough to count\n',
        'context/memory/2026-10-25.md': '- Gotcha: new lesson that is long enough to count\n',
        'context/memory/.distill-state.json': { lastRun: '2026-10-01', runs: [] },
    });
    const r = distill({ root, now: NOW });
    assert.strictEqual(r.since, '2026-10-01');
    assert.strictEqual(r.sessions, 1);
    assert.strictEqual(r.logs, 1);
    assert.ok(r.lessons.every((l) => l.text.includes('new lesson')));
});

test('CI-failure lines in the steward shape are grouped by job and error', () => {
    const root = fixture({
        'context/memory/2026-10-20.md': '- CI-failure: typecheck | TS2307 cannot find therr-react/lib 12 | libs not built | abc123\n',
        'context/memory/2026-10-22.md': '- CI-failure: typecheck | TS2307 cannot find therr-react/lib 40 | libs not built | def456\n',
    });
    const r = distill({ root, since: '2026-10-01', now: NOW });
    assert.strictEqual(r.ci.length, 1, 'numbers in the error do not split the group');
    assert.strictEqual(r.ci[0].count, 2);
    assert.deepStrictEqual(r.ci[0].causes, ['libs not built']);
});

test('a lesson quoting an identifier that a CLAUDE.md already mentions is marked promoted', () => {
    const targets = [{ file: 'therr-services/users-service/CLAUDE.md', text: 'Use `getSmsSender()` for every send.' }];
    assert.ok(promotedIn('- Gotcha: always go through `getSmsSender()` here', targets));
    assert.strictEqual(promotedIn('- Gotcha: the `general` branch is shared', [{ file: 'CLAUDE.md', text: 'general' }]), null,
        'plain words are not distinctive enough');
    assert.strictEqual(promotedIn('- Gotcha: no identifiers in this one at all', targets), null);
});

test('permission refusals and hook errors are grouped and counted', () => {
    const root = fixture({
        'context/transcripts/digests/a.json': digest('a', '2026-10-20', [], {
            permissionDenials: [{ tool: 'Bash', input: 'kubectl set env deploy/x A=1', reason: 'denied' }],
            hookErrors: [{ hook: 'SessionStart:startup', error: 'prompt hooks unsupported' }],
        }),
        'context/transcripts/digests/b.json': digest('b', '2026-10-21', [], {
            permissionDenials: [{ tool: 'Bash', input: 'kubectl set env deploy/y B=2', reason: 'denied' }],
            hookErrors: [{ hook: 'SessionStart:startup', error: 'prompt hooks unsupported' }],
        }),
    });
    const r = distill({ root, since: '2026-10-01', now: NOW });
    assert.strictEqual(r.denials.length, 1);
    assert.strictEqual(r.denials[0].count, 2);
    assert.strictEqual(r.hookErrors[0].count, 2);
});

test('the markdown report renders every section, empty or not, and stays small', () => {
    const root = fixture({});
    const md = renderMarkdown(distill({ root, since: '2026-10-01', now: NOW }));
    for (const heading of ['Repeated failures', 'CI failures', 'Permission refusals', 'Hook errors', 'Unresolved errors', 'User corrections', 'Lessons']) {
        assert.ok(md.includes(heading), heading);
    }
    assert.ok(md.length < 4000);
});

test('--mark records the run and keeps a bounded history', () => {
    const root = fixture({ 'context/memory/.keep': '' });
    for (let i = 0; i < 25; i += 1) markRun(root, NOW, { repeats: i });
    const state = JSON.parse(fs.readFileSync(path.join(root, 'context/memory/.distill-state.json'), 'utf8'));
    assert.strictEqual(state.lastRun, '2026-10-28');
    assert.strictEqual(state.runs.length, 20);
});

let failed = 0;
for (const { name, fn } of tests) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed += 1;
        console.log(`  ✗ ${name}\n    ${e.message}`);
    }
}
console.log(`memory-distill: ${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
