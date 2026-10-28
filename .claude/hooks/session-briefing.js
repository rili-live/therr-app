const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// SessionStart hook: prints a briefing that Claude Code adds to the session's
// context before the first turn. A SessionStart command hook's stdout becomes
// context, so everything CLAUDE.md used to ask the model to go and read at
// session start (branch, project brief, USER.md, MEMORY.md, today's log, the
// open Manual Operational Follow-ups) arrives with zero tool calls.
//
// This replaced a `type: "prompt"` SessionStart hook. Prompt hooks are not
// supported on SessionStart, so that one failed with a non-blocking error at
// the start of every session and injected nothing.
//
// Constraints:
//   - Never fail or block a session. Every section is best-effort.
//   - Stay small. Each block is capped; the whole briefing sits under ~3k tokens.
//   - Stable before volatile. Memory files change rarely and come first; the
//     git status changes every session and comes last.

const CAPS = {
    user: 1500,
    memory: 2700,
    log: 4000,
    followUpLine: 220,
};
const FOLLOW_UPS_SHOWN = 3;

const GENERIC_TOKENS = new Set([
    'feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'tests', 'general', 'niche',
    'stage', 'main', 'claude', 'ccr', 'src', 'lib', 'therr', 'services', 'service',
    'public', 'library', 'client', 'index', 'utils', 'utilities', 'store', 'routes',
]);

const git = (args, cwd) => {
    try {
        return execFileSync('git', args, {
            cwd, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch (e) {
        return null;
    }
};

const readIfExists = (file) => {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
};

const capHead = (text, cap) => (text.length <= cap
    ? text
    : `${text.slice(0, cap).trimEnd()}\n… (truncated at ${cap} of ${text.length} chars)`);

// Logs grow downward, so the newest entries are at the end.
const capTail = (text, cap) => (text.length <= cap
    ? text
    : `… (showing the last ${cap} of ${text.length} chars)\n${text.slice(-cap).trimStart()}`);

// A file that is still the bare template (comments and headings only) is noise.
const hasContent = (text) => !!text && text
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .some((l) => l.trim() && !/^#+\s/.test(l.trim()));

// Template comments (`<!-- Cap: … -->`) are for whoever edits the file, not for the session.
const stripComments = (text) => text.replace(/<!--[\s\S]*?-->\n?/g, '').trim();

const ymd = (d) => d.toISOString().slice(0, 10);

// Which branch does work here land on, and which brief goes with it?
// A feature branch is attributed to whichever integration branch it is fewest
// commits ahead of.
const classifyBranch = (branch, cwd, revCount = (range) => git(['rev-list', '--count', range], cwd)) => {
    const briefFor = (tag) => (tag ? `docs/niche-sub-apps/${tag}_PROJECT_BRIEF.md` : 'docs/niche-sub-apps/PROJECT_BRIEF.md');
    if (!branch) return { base: null, brief: briefFor(null), note: 'branch unknown' };
    if (['general', 'stage', 'main'].includes(branch)) {
        return { base: branch, brief: briefFor(null), note: 'shared branch — deploys via general → stage → main' };
    }
    const niche = branch.match(/^niche\/([A-Z]+)-(general|main)$/);
    if (niche) {
        return { base: branch, brief: briefFor(niche[1]), note: 'niche branch — never deploys backend/shared code' };
    }
    const candidates = ['origin/general'];
    const remotes = git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/niche/'], cwd) || '';
    remotes.split('\n').filter((r) => /-general$/.test(r)).forEach((r) => candidates.push(r));
    let best = null;
    for (const ref of candidates) {
        const n = parseInt(revCount(`${ref}..HEAD`), 10);
        if (!Number.isNaN(n) && (best === null || n < best.n)) best = { ref, n };
    }
    if (!best) return { base: null, brief: briefFor(null), note: 'feature branch — base unknown (no origin/general ref)' };
    const base = best.ref.replace(/^origin\//, '');
    const tag = (base.match(/^niche\/([A-Z]+)-general$/) || [])[1];
    return {
        base,
        brief: briefFor(tag),
        note: `feature branch, ${best.n} commit(s) ahead of ${base} — lands on ${base}`,
    };
};

// Keywords that say what the current work touches, from changed paths and the
// branch name. Used only to rank follow-ups; a wrong guess just reorders them.
const workKeywords = (branch, changedFiles) => {
    const words = new Set();
    const add = (w) => {
        const t = w.toLowerCase();
        if (t.length >= 4 && !GENERIC_TOKENS.has(t) && !/^\d+$/.test(t)) words.add(t);
    };
    (branch || '').split(/[/_.-]+/).forEach(add);
    for (const file of changedFiles) {
        const parts = file.split('/');
        if (parts[0] === 'therr-services' && parts[1]) {
            add(parts[1]);
        } else if (parts[0] === 'TherrMobile') {
            add('mobile');
            add('play');
        } else if (parts[0] === 'therr-client-web') {
            add('web');
        } else if (parts[0] === 'therr-api-gateway') {
            add('gateway');
        } else if (parts[0] === 'therr-public-library' && parts[1]) {
            add(parts[1]);
        }
        if (file.includes('/migrations/')) add('migration');
        const base = path.basename(file).replace(/\.[^.]+$/, '');
        base.split(/(?=[A-Z])|[^a-zA-Z0-9]+/).forEach(add);
    }
    return [...words];
};

// Parse the unchecked items under the `# Manual Operational Follow-ups` H1 of
// docs/WORK_IN_PROGRESS.md. Items span lines; only the first line is shown.
const parseFollowUps = (text) => {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^# Manual Operational Follow-ups\s*$/.test(l));
    if (start === -1) return [];
    const items = [];
    let section = '';
    let current = null;
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (/^# /.test(line)) break;
        const heading = line.match(/^##+\s+(.*)/);
        if (heading) {
            section = heading[1].trim();
            current = null;
        } else if (/^\s*- \[ \]/.test(line)) {
            current = { line: i + 1, section, text: line.replace(/^\s*- \[ \]\s*/, '') };
            items.push(current);
        } else if (current && /^\s{2,}\S/.test(line)) {
            current.text += ` ${line.trim()}`;
        } else if (!line.trim() || /^\s*- /.test(line)) {
            current = null;
        }
    }
    return items;
};

const rankFollowUps = (items, keywords) => {
    const scored = items.map((item, idx) => {
        const hay = `${item.section} ${item.text}`.toLowerCase();
        const score = keywords.reduce((s, k) => s + (hay.includes(k) ? 1 : 0), 0);
        return { item, idx, score };
    });
    // Highest score first; document order breaks ties (newest sections sit on top).
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
    return scored.map((s) => ({ ...s.item, score: s.score }));
};

const oneLine = (text, cap) => {
    const flat = text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    return flat.length <= cap ? flat : `${flat.slice(0, cap - 1)}…`;
};

const buildBriefing = ({ root, now = new Date(), gitFn = git }) => {
    const out = [];
    out.push('# Session briefing');
    out.push('Injected by `.claude/hooks/session-briefing.js`. The files quoted below are already in context — do not re-read them at session start.');

    const branch = gitFn(['rev-parse', '--abbrev-ref', 'HEAD'], root);
    const cls = classifyBranch(branch, root, (range) => gitFn(['rev-list', '--count', range], root));
    out.push('');
    out.push(`**Branch:** \`${branch || 'unknown'}\` (${cls.note})`);
    out.push(`**Project brief:** \`${cls.brief}\` — read it before non-trivial work.`);

    const user = readIfExists(path.join(root, 'context', 'USER.md'));
    if (hasContent(user)) {
        out.push('', '## context/USER.md', capHead(stripComments(user), CAPS.user));
    }
    const memory = readIfExists(path.join(root, 'context', 'MEMORY.md'));
    if (hasContent(memory)) {
        out.push('', '## context/MEMORY.md', capHead(stripComments(memory), CAPS.memory));
    }

    const today = ymd(now);
    const yesterday = ymd(new Date(now.getTime() - 86400000));
    let logName = today;
    let log = readIfExists(path.join(root, 'context', 'memory', `${today}.md`));
    if (!hasContent(log)) {
        logName = yesterday;
        log = readIfExists(path.join(root, 'context', 'memory', `${yesterday}.md`));
    }
    if (hasContent(log)) {
        const label = logName === today ? "today's log" : "yesterday's log (none yet today)";
        out.push('', `## context/memory/${logName}.md — ${label}`, capTail(log.trim(), CAPS.log));
    } else {
        out.push('', `No daily log for ${today} or ${yesterday} yet — start \`context/memory/${today}.md\` when there is something to log.`);
    }

    const wip = readIfExists(path.join(root, 'docs', 'WORK_IN_PROGRESS.md'));
    if (wip) {
        const items = parseFollowUps(wip);
        if (items.length) {
            const diffBase = cls.base && cls.base !== branch ? `origin/${cls.base}...HEAD` : null;
            const changed = [
                ...((diffBase && gitFn(['diff', '--name-only', diffBase], root)) || '').split('\n'),
                ...(gitFn(['diff', '--name-only', 'HEAD'], root) || '').split('\n'),
            ].filter(Boolean);
            const ranked = rankFollowUps(items, workKeywords(branch, changed));
            out.push('', `## Manual Operational Follow-ups — ${items.length} open`);
            out.push('Most relevant to the current work (surface these to the user if the session is non-trivial):');
            ranked.slice(0, FOLLOW_UPS_SHOWN).forEach((it) => {
                out.push(`- docs/WORK_IN_PROGRESS.md:${it.line} [${oneLine(it.section, 60)}] ${oneLine(it.text, CAPS.followUpLine)}`);
            });
        }
    }

    const status = gitFn(['status', '--porcelain'], root);
    if (status !== null) {
        const rows = status.split('\n').filter(Boolean);
        const untracked = rows.filter((r) => r.startsWith('??')).length;
        out.push('', '## Working tree');
        out.push(rows.length
            ? `${rows.length - untracked} modified/staged, ${untracked} untracked: ${rows.slice(0, 8).map((r) => r.slice(3)).join(', ')}${rows.length > 8 ? ', …' : ''}`
            : 'clean');
    }

    return `${out.join('\n')}\n`;
};

module.exports = {
    buildBriefing, classifyBranch, parseFollowUps, rankFollowUps, workKeywords, hasContent,
};

if (require.main === module) {
    try {
        let input = {};
        try {
            input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
        } catch (e) {
            input = {};
        }
        const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
        process.stdout.write(buildBriefing({ root }));
    } catch (e) {
        // Never break a session over a briefing.
    }
    process.exit(0);
}
