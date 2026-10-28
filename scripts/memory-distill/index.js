#!/usr/bin/env node
// memory-distill — aggregate execution logs into promotion candidates.
//
// The deterministic half of /memory-distill. It reads what past sessions left
// behind and prints a short report of the things worth turning into durable
// memory, so the model spends its context judging candidates, not reading logs.
//
// Sources, since the last distill (or --since):
//   - context/transcripts/digests/*.json — one per session, from session-digest.js
//     (machine-local: only sessions run on this machine)
//   - context/memory/YYYY-MM-DD.md       — daily logs (git-tracked: every machine's)
//
// What it looks for:
//   - the same failure signature in two or more sessions (the system is not learning)
//   - errors no later call resolved, permission refusals, hook errors, corrections
//   - `CI-failure:` lines (the shape the steward skill asks for), grouped
//   - lesson-shaped log lines (Gotcha / Lesson / Root cause / …), each checked against
//     the CLAUDE.md files and skills for whether it was already promoted
//
// Usage:
//   node scripts/memory-distill/index.js              # markdown report
//   node scripts/memory-distill/index.js --json       # the same, as JSON
//   node scripts/memory-distill/index.js --since 2026-10-01
//   node scripts/memory-distill/index.js --stats      # one-line counts (memory-stats.sh)
//   node scripts/memory-distill/index.js --mark       # record today as the last run
//
// Stdlib only, so it runs without an install (CI, a fresh clone).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STATE_FILE = path.join('context', 'memory', '.distill-state.json');
const DEFAULT_WINDOW_DAYS = 30;
const LIMITS = {
    repeats: 15, unresolved: 10, denials: 10, corrections: 8, lessons: 25, ci: 15, text: 220,
};

const LESSON_CUE = /\b(gotcha|lesson|root cause|never again|footgun|turned out|the trap|bit us|silently)\b/i;
const CI_LINE = /CI-failure:\s*(.+)$/;

const readJson = (file, fallback) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return fallback;
    }
};

const clip = (text, cap = LIMITS.text) => {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return flat.length <= cap ? flat : `${flat.slice(0, cap - 1)}…`;
};

const ymd = (d) => d.toISOString().slice(0, 10);

const loadState = (root) => readJson(path.join(root, STATE_FILE), { lastRun: null, runs: [] });

const resolveSince = (root, argSince, now = new Date()) => {
    if (argSince) return argSince;
    const state = loadState(root);
    if (state.lastRun) return state.lastRun;
    return ymd(new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 86400000));
};

const loadDigests = (root, since) => {
    const dir = path.join(root, 'context', 'transcripts', 'digests');
    let files = [];
    try {
        files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch (e) {
        return [];
    }
    return files
        .map((f) => readJson(path.join(dir, f), null))
        .filter((d) => d && (d.endedAt || d.startedAt || '').slice(0, 10) >= since);
};

const loadLogs = (root, since) => {
    const dir = path.join(root, 'context', 'memory');
    let files = [];
    try {
        files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
    } catch (e) {
        return [];
    }
    return files
        .filter((f) => f.slice(0, 10) >= since)
        .sort()
        .map((f) => ({ file: path.join('context', 'memory', f), date: f.slice(0, 10), text: fs.readFileSync(path.join(dir, f), 'utf8') }));
};

// Where a promoted lesson would live: CLAUDE.md files, skills and top-level docs.
// Depth-limited walk; never into dependencies.
const loadPromotionTargets = (root) => {
    const out = [];
    const walk = (dir, depth) => {
        if (depth > 3) return;
        let entries = [];
        try {
            entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
        } catch (e) {
            return;
        }
        for (const e of entries) {
            if (['node_modules', '.git', 'lib', 'build', 'android', 'ios', 'context', '.memsearch'].includes(e.name)) continue;
            const rel = path.join(dir, e.name);
            if (e.isDirectory()) walk(rel, depth + 1);
            else if (e.name === 'CLAUDE.md' || e.name === 'SKILL.md') out.push({ file: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') });
        }
    };
    walk('.', 0);
    walk(path.join('.claude', 'skills'), 0);
    // Top-level docs count too (a lesson often lands in a runbook), except the backlog,
    // which quotes everything and would mark every lesson as promoted.
    try {
        fs.readdirSync(path.join(root, 'docs'))
            .filter((f) => f.endsWith('.md') && f !== 'WORK_IN_PROGRESS.md')
            .forEach((f) => out.push({ file: path.join('docs', f), text: fs.readFileSync(path.join(root, 'docs', f), 'utf8') }));
    } catch (e) {
        // no docs/ in this checkout
    }
    const seen = new Set();
    return out.filter((t) => (seen.has(t.file) ? false : seen.add(t.file)));
};

// A lesson counts as already promoted when a distinctive token it quotes (a
// backticked identifier, a file name, an env var) appears in a CLAUDE.md or skill.
const promotedIn = (lesson, targets) => {
    const tokens = [...lesson.matchAll(/`([^`]{6,80})`/g)].map((m) => m[1].trim())
        .concat([...lesson.matchAll(/\b([A-Z][A-Z0-9_]{7,})\b/g)].map((m) => m[1]))
        // A plain word (`general`, `:latest`) is everywhere; only identifier-shaped
        // tokens — a path, a call, camelCase, a digit — or long ones say "this lesson".
        .filter((t) => /[./_()-]|[a-z][A-Z]|\d/.test(t) || t.length >= 12);
    for (const token of tokens) {
        const hit = targets.find((t) => t.text.includes(token));
        if (hit) return { file: path.normalize(hit.file), token };
    }
    return null;
};

const extractFromLogs = (logs, targets) => {
    const lessons = [];
    const ci = new Map();
    for (const log of logs) {
        const lines = log.text.split('\n');
        lines.forEach((line, i) => {
            const ciMatch = line.match(CI_LINE);
            if (ciMatch) {
                const [job = '', error = '', cause = '', fix = ''] = ciMatch[1].split('|').map((s) => s.trim());
                const key = `${job} | ${error.replace(/\d+/g, '<n>').slice(0, 80)}`;
                const entry = ci.get(key) || { job, error: clip(error, 120), causes: new Set(), fixes: new Set(), dates: new Set() };
                if (cause) entry.causes.add(clip(cause, 120));
                if (fix) entry.fixes.add(clip(fix, 60));
                entry.dates.add(log.date);
                ci.set(key, entry);
                return;
            }
            if (LESSON_CUE.test(line) && line.trim().length > 25) {
                const text = clip(line.replace(/^\s*[-*#]+\s*/, ''));
                lessons.push({ where: `${log.file}:${i + 1}`, date: log.date, text, promoted: promotedIn(line, targets) });
            }
        });
    }
    return {
        lessons: lessons.reverse(),
        ci: [...ci.values()].map((e) => ({
            job: e.job, error: e.error, count: e.dates.size, dates: [...e.dates].sort(), causes: [...e.causes], fixes: [...e.fixes],
        })).sort((a, b) => b.count - a.count),
    };
};

const aggregateDigests = (digests) => {
    const bySig = new Map();
    const denials = new Map();
    const hookErrors = new Map();
    const unresolved = [];
    const corrections = [];
    let interrupts = 0;
    let noVerify = 0;
    for (const d of digests) {
        const day = (d.endedAt || d.startedAt || '').slice(0, 10);
        for (const e of d.errors || []) {
            const entry = bySig.get(e.signature) || {
                signature: e.signature, sessions: new Set(), dates: new Set(), example: e.input, error: e.error, resolvedBy: new Set(),
            };
            entry.sessions.add(d.sessionId);
            entry.dates.add(day);
            if (e.resolvedBy) entry.resolvedBy.add(e.resolvedBy);
            bySig.set(e.signature, entry);
            if (!e.resolvedBy) unresolved.push({ day, ...e });
        }
        for (const p of d.permissionDenials || []) {
            const key = `${p.tool}: ${String(p.input || '').split(/\s+/).slice(0, 3).join(' ')}`;
            const entry = denials.get(key) || { key, count: 0, dates: new Set(), example: p.input };
            entry.count += 1;
            entry.dates.add(day);
            denials.set(key, entry);
        }
        for (const h of d.hookErrors || []) {
            const key = `${h.hook}: ${h.error}`;
            const entry = hookErrors.get(key) || { hook: h.hook, error: h.error, count: 0 };
            entry.count += 1;
            hookErrors.set(key, entry);
        }
        (d.corrections || []).forEach((c) => corrections.push({ day, text: c }));
        interrupts += d.interrupts || 0;
        noVerify += d.noVerify || 0;
    }
    const repeats = [...bySig.values()]
        .filter((e) => e.sessions.size >= 2)
        .map((e) => ({
            signature: e.signature, sessions: e.sessions.size, dates: [...e.dates].sort(), example: e.example, error: e.error, resolvedBy: [...e.resolvedBy].slice(0, 3),
        }))
        .sort((a, b) => b.sessions - a.sessions);
    return {
        sessions: digests.length,
        repeats,
        unresolved: unresolved.slice(-LIMITS.unresolved).reverse(),
        denials: [...denials.values()].map((e) => ({ ...e, dates: [...e.dates].sort() })).sort((a, b) => b.count - a.count),
        hookErrors: [...hookErrors.values()].sort((a, b) => b.count - a.count),
        corrections: corrections.slice(-LIMITS.corrections).reverse(),
        interrupts,
        noVerify,
    };
};

const memoryHealth = (root) => {
    const size = (rel) => {
        try {
            return fs.statSync(path.join(root, rel)).size;
        } catch (e) {
            return 0;
        }
    };
    return { memoryChars: size('context/MEMORY.md'), memoryCap: 2500, userChars: size('context/USER.md'), userCap: 1375 };
};

const distill = ({ root = ROOT, since, now = new Date() } = {}) => {
    const from = resolveSince(root, since, now);
    const digests = loadDigests(root, from);
    const logs = loadLogs(root, from);
    const targets = loadPromotionTargets(root);
    return {
        since: from,
        until: ymd(now),
        logs: logs.length,
        ...aggregateDigests(digests),
        ...extractFromLogs(logs, targets),
        health: memoryHealth(root),
        lastRun: loadState(root).lastRun,
    };
};

const renderMarkdown = (r) => {
    const out = [];
    const section = (title, rows, render, limit) => {
        out.push('', `## ${title}`);
        if (!rows.length) {
            out.push('_none_');
            return;
        }
        rows.slice(0, limit).forEach((row) => out.push(render(row)));
        if (rows.length > limit) out.push(`_… ${rows.length - limit} more (use --json)_`);
    };
    out.push(`# Memory distill — ${r.since} → ${r.until}`);
    out.push(`${r.sessions} session digest(s) (this machine), ${r.logs} daily log(s). Last distill: ${r.lastRun || 'never'}.`);
    out.push(`MEMORY.md ${r.health.memoryChars}/${r.health.memoryCap} chars · USER.md ${r.health.userChars}/${r.health.userCap} chars · `
        + `${r.interrupts} interrupt(s) · ${r.noVerify} --no-verify`);
    section('Repeated failures (same signature, 2+ sessions) — strongest promotion candidates', r.repeats, (e) => `- **${e.sessions} sessions** (${e.dates.join(', ')}) \`${e.signature}\`\n  e.g. \`${e.example}\` → ${e.error}${e.resolvedBy.length ? `\n  fixed by: ${e.resolvedBy.map((x) => `\`${x}\``).join('; ')}` : '\n  never resolved in-session'}`, LIMITS.repeats);
    section('CI failures logged by /steward', r.ci, (e) => `- **${e.count}×** ${e.job} — ${e.error} (${e.dates.join(', ')})${e.causes.length ? `\n  cause: ${e.causes.join('; ')}` : ''}`, LIMITS.ci);
    section('Permission refusals (candidates for an allow/ask rule or steward §5)', r.denials, (e) => `- **${e.count}×** \`${e.key}\` (${e.dates.join(', ')}) e.g. \`${e.example}\``, LIMITS.denials);
    section('Hook errors', r.hookErrors, (e) => `- **${e.count}×** ${e.hook}: ${e.error}`, LIMITS.denials);
    section('Unresolved errors (most recent)', r.unresolved, (e) => `- ${e.day} \`${e.input}\` → ${e.error}`, LIMITS.unresolved);
    section('User corrections (most recent)', r.corrections, (e) => `- ${e.day} "${e.text}"`, LIMITS.corrections);
    const open = r.lessons.filter((l) => !l.promoted);
    const done = r.lessons.length - open.length;
    section(`Lessons in daily logs not yet in any CLAUDE.md, skill or doc (${done} others already are)`, open, (l) => `- ${l.where} — ${l.text}`, LIMITS.lessons);
    return `${out.join('\n')}\n`;
};

const markRun = (root, now = new Date(), summary = {}) => {
    const state = loadState(root);
    state.lastRun = ymd(now);
    state.runs = [...(state.runs || []), { date: ymd(now), ...summary }].slice(-20);
    fs.writeFileSync(path.join(root, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
    return state;
};

module.exports = {
    distill, renderMarkdown, markRun, aggregateDigests, extractFromLogs, promotedIn, resolveSince,
};

if (require.main === module) {
    const args = process.argv.slice(2);
    const flag = (name) => args.includes(name);
    const value = (name) => {
        const i = args.indexOf(name);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const report = distill({ since: value('--since') });
    if (flag('--mark')) {
        markRun(ROOT, new Date(), { repeats: report.repeats.length, lessons: report.lessons.filter((l) => !l.promoted).length });
        console.log(`Marked ${ymd(new Date())} as the last distill run (${STATE_FILE}).`);
    } else if (flag('--stats')) {
        console.log([
            `digests=${report.sessions}`,
            `repeated_failures=${report.repeats.length}`,
            `unresolved_errors=${report.unresolved.length}`,
            `permission_refusals=${report.denials.reduce((s, d) => s + d.count, 0)}`,
            `unpromoted_lessons=${report.lessons.filter((l) => !l.promoted).length}`,
            `last_run=${report.lastRun || 'never'}`,
        ].join(' '));
    } else if (flag('--json')) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        process.stdout.write(renderMarkdown(report));
    }
}
