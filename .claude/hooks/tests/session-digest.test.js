// Tests for the session digest hook.
//
// The digest is raw material for /memory-distill, so two properties matter most:
// it must find the signal (failures, what fixed them, refusals, corrections) in the
// transcript shape Claude Code actually writes, and it must never carry a secret
// or a person's contact details out of the transcript into a file that outlives it.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    buildDigest, signature, redact, bypassesHooks,
} = require('../session-digest');

const HOOK = path.resolve(__dirname, '..', 'session-digest.js');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Builders for the JSONL envelopes, matching the fields the real transcript carries.
let n = 0;
const ts = () => {
    n += 1;
    return new Date(Date.UTC(2026, 9, 28, 12, 0, n)).toISOString();
};
const base = { sessionId: 's1', gitBranch: 'feat/x', isSidechain: false };
const userText = (text) => ({
    ...base, type: 'user', timestamp: ts(), message: { role: 'user', content: text },
});
const toolUse = (id, name, input) => ({
    ...base,
    type: 'assistant',
    timestamp: ts(),
    message: {
        role: 'assistant',
        content: [{
            type: 'tool_use', id, name, input,
        }],
    },
});
const toolResult = (id, content, isError = false) => ({
    ...base,
    type: 'user',
    timestamp: ts(),
    message: {
        role: 'user',
        content: [{
            type: 'tool_result', tool_use_id: id, is_error: isError, content,
        }],
    },
});
const lines = (...objs) => objs.map((o) => JSON.stringify(o));

test('a failed command is recorded with the later call that fixed it', () => {
    const d = buildDigest(lines(
        userText('run the tests'),
        toolUse('t1', 'Bash', { command: 'npm test --prefix therr-services/users-service' }),
        toolResult('t1', 'Exit code 1\nError: Cannot find module ./lib/index.js', true),
        toolUse('t2', 'Bash', { command: 'cd therr-public-library/therr-js-utilities && npm run build' }),
        toolResult('t2', 'built'),
        toolUse('t3', 'Bash', { command: 'npm test --prefix therr-services/users-service' }),
        toolResult('t3', '1722 passing'),
    ));
    assert.strictEqual(d.errors.length, 1);
    assert.strictEqual(d.errors[0].tool, 'Bash');
    assert.ok(d.errors[0].error.includes('Cannot find module'));
    assert.ok(d.errors[0].resolvedBy.startsWith('npm test'));
    assert.strictEqual(d.unresolvedErrors, 0);
    assert.strictEqual(d.toolCalls.Bash, 3);
});

test('an error nothing later fixed counts as unresolved', () => {
    const d = buildDigest(lines(
        toolUse('t1', 'Bash', { command: 'npx tsc -p therr-client-web' }),
        toolResult('t1', 'Exit code 2\nsrc/a.ts(3,1): error TS2304', true),
    ));
    assert.strictEqual(d.unresolvedErrors, 1);
});

test('permission refusals are separated from ordinary errors', () => {
    const d = buildDigest(lines(
        toolUse('t1', 'Bash', { command: 'kubectl set env deploy/gateway X=1' }),
        toolResult('t1', 'Permission to use Bash with command kubectl set env has been denied by the auto-mode classifier.', true),
    ));
    assert.strictEqual(d.permissionDenials.length, 1);
    assert.strictEqual(d.errors.length, 0);
    assert.ok(d.permissionDenials[0].input.startsWith('kubectl set env'));
});

test('interrupts, corrections, skills, subagents and edited files are captured', () => {
    const d = buildDigest(lines(
        userText('add the migration'),
        toolUse('t1', 'Skill', { skill: 'db-migration-scaffold' }),
        toolResult('t1', 'ok'),
        toolUse('t2', 'Write', { file_path: '/repo/therr-services/users-service/src/store/migrations/x.js', content: '' }),
        toolResult('t2', 'ok'),
        userText('[Request interrupted by user]'),
        userText('no, that belongs in the habits schema'),
        toolUse('t3', 'Agent', { subagent_type: 'Explore', prompt: 'find' }),
        toolResult('t3', 'done'),
    ), { projectDir: '/repo' });
    assert.deepStrictEqual(d.skills, ['db-migration-scaffold']);
    assert.deepStrictEqual(d.subagents, ['Explore']);
    assert.deepStrictEqual(d.filesTouched, ['therr-services/users-service/src/store/migrations/x.js']);
    assert.strictEqual(d.interrupts, 1);
    assert.strictEqual(d.corrections.length, 1);
    assert.strictEqual(d.prompts, 2);
    assert.strictEqual(d.firstPrompt, 'add the migration');
});

test('hook errors recorded by the harness are surfaced', () => {
    const d = buildDigest(lines({
        ...base,
        type: 'attachment',
        timestamp: ts(),
        attachment: { type: 'hook_non_blocking_error', hookName: 'SessionStart:startup', stderr: 'Failed to run: prompt-type hooks are not supported' },
    }));
    assert.strictEqual(d.hookErrors.length, 1);
    assert.strictEqual(d.hookErrors[0].hook, 'SessionStart:startup');
});

test('subagent (sidechain) traffic and malformed lines are ignored', () => {
    const side = { ...toolUse('t9', 'Bash', { command: 'ls' }), isSidechain: true };
    const d = buildDigest([...lines(side), '{not json', '']);
    assert.deepStrictEqual(d.toolCalls, {});
});

test('--no-verify counts only on a real git commit or push, not in text that mentions it', () => {
    assert.strictEqual(bypassesHooks('git add -A && git commit -m x --no-verify'), true);
    assert.strictEqual(bypassesHooks('cd repo && git push --no-verify origin x'), true);
    assert.strictEqual(bypassesHooks("python3 - <<'EOF'\ns = 'git push --no-verify'\nEOF"), false);
    assert.strictEqual(bypassesHooks('grep -n no-verify .husky/pre-push'), false);
});

test('redaction removes tokens, keys, emails and phone numbers', () => {
    const text = redact([
        'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123',
        'mail a.b@example.com call +44 7700 900123',
        'Bearer abc.def.ghijklmnop sk-ant-abcdefghijklmnopqrstu',
    ].join(' '));
    assert.ok(!text.includes('ghp_'));
    assert.ok(!text.includes('example.com'));
    assert.ok(!text.includes('7700'));
    assert.ok(!text.includes('abc.def'));
    assert.ok(!text.includes('sk-ant'));
});

test('signatures are stable across volatile detail so repeats can be counted', () => {
    const a = signature('Bash', 'Exit code 1\nError: ENOENT: no such file, open \'/home/a/therr-app/lib/x.js\' at line 42');
    const b = signature('Bash', 'Exit code 1\nError: ENOENT: no such file, open \'/Users/b/code/lib/y.js\' at line 7');
    assert.strictEqual(a, b);
    assert.ok(!a.includes('Exit code'));
});

test('the hook writes <session>.json atomically and exits 0 on bad input', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-'));
    const transcript = path.join(dir, 't.jsonl');
    fs.writeFileSync(transcript, lines(userText('hello')).join('\n'));
    const env = { ...process.env, THERR_DIGEST_DIR: path.join(dir, 'out') };
    execFileSync('node', [HOOK], { input: JSON.stringify({ transcript_path: transcript, hook_event_name: 'SessionEnd' }), env });
    const out = JSON.parse(fs.readFileSync(path.join(dir, 'out', 's1.json'), 'utf8'));
    assert.strictEqual(out.event, 'SessionEnd');
    assert.ok(!fs.readdirSync(path.join(dir, 'out')).some((f) => f.endsWith('.tmp')));
    execFileSync('node', [HOOK], { input: 'garbage', env }); // must not throw
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
console.log(`session-digest: ${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
