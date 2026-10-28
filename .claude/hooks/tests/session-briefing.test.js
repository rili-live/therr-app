// Tests for the SessionStart briefing hook.
//
// What has to hold: the briefing always prints (a session must never start
// without it because one input was missing), it stays inside its size budget,
// and it routes the branch to the right project brief — a niche feature branch
// briefed as `general` would have the agent commit brand work to the shared line.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    buildBriefing, classifyBranch, parseFollowUps, statusPath, rankFollowUps, workKeywords, hasContent,
} = require('../session-briefing');

const HOOK = path.resolve(__dirname, '..', 'session-briefing.js');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const fixture = (files) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-'));
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    return root;
};

// A git stub keyed by the first argument, so no test depends on a real repo.
const stubGit = (answers) => (args) => {
    const key = args.join(' ');
    for (const [prefix, value] of Object.entries(answers)) {
        if (key.startsWith(prefix)) return value;
    }
    return null;
};

const WIP = [
    '# Work In Progress',
    '',
    '# Manual Operational Follow-ups',
    '',
    '## Twilio SMS guards',
    '',
    '- [ ] **Match Twilio geo permissions** to the code tiers in',
    '  `sms-destination-policy.ts`.',
    '- [x] Already done item',
    '',
    '## Habits challenges',
    '',
    '- [ ] Run the users-service migration after the deploy.',
    '- [ ] Smoke-test a share link once deployed.',
    '',
    '# TODO Backlog by Business Value',
    '',
    '- [ ] not a follow-up',
].join('\n');

test('parseFollowUps reads only unchecked items under the Manual Operational Follow-ups H1', () => {
    const items = parseFollowUps(WIP);
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].section, 'Twilio SMS guards');
    assert.ok(items[0].text.includes('sms-destination-policy.ts'), 'continuation line is folded in');
    assert.strictEqual(items[0].line, 7);
    assert.ok(!items.some((i) => i.text.includes('not a follow-up')));
});

test('parseFollowUps returns nothing when the section is missing', () => {
    assert.deepStrictEqual(parseFollowUps('# Something else\n- [ ] x'), []);
});

test('rankFollowUps puts items matching the current work first and keeps document order otherwise', () => {
    const ranked = rankFollowUps(parseFollowUps(WIP), ['users-service']);
    assert.ok(ranked[0].text.startsWith('Run the users-service migration'));
    assert.ok(ranked[1].text.includes('Twilio'), 'ties keep document order');
});

test('workKeywords derives package and file-name words, dropping generic ones', () => {
    const words = workKeywords('fix/sms-app-check', [
        'therr-services/users-service/src/handlers/phone.ts',
        'TherrMobile/main/utilities/appCheck.ts',
    ]);
    assert.ok(words.includes('users-service'));
    assert.ok(words.includes('mobile'));
    assert.ok(words.includes('phone'));
    assert.ok(!words.includes('check'), 'tooling words are dropped');
    assert.ok(!words.includes('fix'));
});

test('classifyBranch maps shared and niche branches to their briefs', () => {
    assert.strictEqual(classifyBranch('general', '.').brief, 'docs/niche-sub-apps/PROJECT_BRIEF.md');
    assert.strictEqual(classifyBranch('niche/HABITS-general', '.').brief, 'docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md');
});

test('classifyBranch attributes a feature branch to the integration branch it is fewest commits ahead of', () => {
    // Real repo for for-each-ref is not needed: the stubbed counter decides.
    const counts = { 'origin/general..HEAD': '40' };
    const cls = classifyBranch('feat/x', '.', (range) => counts[range] || null);
    assert.strictEqual(cls.base, 'general');
    assert.ok(cls.note.includes('40 commit(s) ahead of general'));
});

test('statusPath keeps the full path even when trimming ate the first row\'s leading space', () => {
    assert.strictEqual(statusPath('M .claude/settings.json'), '.claude/settings.json');
    assert.strictEqual(statusPath(' M .claude/settings.json'), '.claude/settings.json');
    assert.strictEqual(statusPath('?? .claude/hooks/x.js'), '.claude/hooks/x.js');
    assert.strictEqual(statusPath('MM a.js'), 'a.js');
});

test('hasContent treats a bare template as empty', () => {
    assert.strictEqual(hasContent('<!-- Cap -->\n# User Profile\n\n## About\n'), false);
    assert.strictEqual(hasContent('# User\n- prefers local runs'), true);
});

test('buildBriefing includes memory, the log, follow-ups and the tree, and skips empty templates', () => {
    const root = fixture({
        'context/USER.md': '<!-- Cap -->\n# User Profile\n\n## About\n',
        'context/MEMORY.md': '<!-- Cap -->\n# Working Memory\n- remember this fact\n',
        'context/memory/2026-10-28.md': '## Today\n- did a thing\n',
        'docs/WORK_IN_PROGRESS.md': WIP,
    });
    const text = buildBriefing({
        root,
        now: new Date('2026-10-28T12:00:00Z'),
        gitFn: stubGit({
            'rev-parse --abbrev-ref HEAD': 'general',
            'status --porcelain': ' M a.js\n?? b.js',
            'diff --name-only HEAD': '',
        }),
    });
    assert.ok(!text.includes('context/USER.md'), 'empty template omitted');
    assert.ok(text.includes('remember this fact'));
    assert.ok(!text.includes('<!-- Cap'), 'template comments stripped');
    assert.ok(text.includes("context/memory/2026-10-28.md — today's log"));
    assert.ok(text.includes('3 open'));
    assert.ok(text.includes('1 modified/staged, 1 untracked'));
});

test('buildBriefing falls back to yesterday and caps a long log from the tail', () => {
    const root = fixture({
        'context/memory/2026-10-27.md': `${'old line\n'.repeat(1000)}NEWEST ENTRY\n`,
    });
    const text = buildBriefing({ root, now: new Date('2026-10-28T12:00:00Z'), gitFn: () => null });
    assert.ok(text.includes("yesterday's log"));
    assert.ok(text.includes('NEWEST ENTRY'), 'tail is kept');
    assert.ok(text.includes('showing the last'));
    assert.ok(text.length < 12000, `briefing stays in budget (${text.length} chars)`);
});

test('buildBriefing nudges for /memory-distill only when it is due', () => {
    const due = fixture({ 'context/memory/.distill-state.json': '{"lastRun":"2026-10-01"}' });
    const fresh = fixture({ 'context/memory/.distill-state.json': '{"lastRun":"2026-10-26"}' });
    const now = new Date('2026-10-28T12:00:00Z');
    assert.ok(buildBriefing({ root: due, now, gitFn: () => null }).includes('Memory distill is due'));
    assert.ok(!buildBriefing({ root: fresh, now, gitFn: () => null }).includes('Memory distill is due'));
    assert.ok(buildBriefing({ root: fixture({}), now, gitFn: () => null }).includes('last run: never'));
});

test('the hook exits 0 and prints a briefing even with no stdin and no context files', () => {
    const root = fixture({});
    const out = execFileSync('node', [HOOK], {
        input: '', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    });
    assert.ok(out.startsWith('# Session briefing'));
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
console.log(`session-briefing: ${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
