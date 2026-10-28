const fs = require('fs');
const path = require('path');

// Stop / PreCompact / SessionEnd hook: turns the session's JSONL transcript into a
// small structured digest at context/transcripts/digests/<session_id>.json.
//
// Why: transcript-capture.js keeps the first 500 characters of each final reply,
// which is the part of a session that is already summarized in the daily log. What
// a later session can learn from is everything that reply leaves out: which
// commands failed and what eventually worked, where the user corrected course or
// interrupted, which permission requests were refused, which hooks errored, and
// whether a gate was bypassed. /memory-distill aggregates these across sessions to
// find repeats worth promoting into memory, a skill, or a lint rule.
//
// Deterministic and model-free: it reads only the transcript the harness already
// wrote. The digest is overwritten on every firing, so Stop (each turn), PreCompact
// and SessionEnd all converge on the same file and a session that never reaches
// SessionEnd (a killed container) still leaves one behind.
//
// Everything captured is redacted (tokens, keys, emails, phone numbers) and capped.
// Digests live under the gitignored context/transcripts/ — they hold command lines
// and error text, which should not be committed. THERR_DIGEST_DIR overrides the
// location.

const CAPS = {
    text: 300,
    command: 200,
    errors: 40,
    corrections: 12,
    files: 60,
};

const CORRECTION_CUE = /^\s*(no\b|nope\b|wrong\b|that's not|that is not|not what|stop\b|don't\b|do not\b|undo\b|revert\b|actually\b|instead\b|why did you)/i;
const PERMISSION_CUE = /(permission|denied|not allowed|was blocked|blocked by|classifier|user (doesn't|does not) want to proceed|rejected)/i;

const REDACTIONS = [
    [/\b(gh[pousr]_[A-Za-z0-9]{20,})/g, '[REDACTED:github-token]'],
    [/\b(sk-[A-Za-z0-9_-]{16,})/g, '[REDACTED:key]'],
    [/\b(AKIA[0-9A-Z]{16})\b/g, '[REDACTED:aws-key]'],
    [/\b(xox[abprs]-[A-Za-z0-9-]{10,})/g, '[REDACTED:slack-token]'],
    [/(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1[REDACTED]'],
    [/((?:api[_-]?key|token|secret|password|passwd|auth)[A-Za-z_]*\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi, '$1[REDACTED]'],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED:email]'],
    [/\+\d[\d\s-]{7,}\d/g, '[REDACTED:phone]'],
    [/\b[A-Za-z0-9+/]{40,}={0,2}/g, '[REDACTED:blob]'],
];

const redact = (text) => REDACTIONS.reduce((s, [re, rep]) => s.replace(re, rep), String(text || ''));

const clip = (text, cap) => {
    const flat = redact(text).replace(/\s+/g, ' ').trim();
    return flat.length <= cap ? flat : `${flat.slice(0, cap - 1)}…`;
};

const firstLines = (text, n = 3) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, n).join(' | ');

// A stable fingerprint for "the same failure" across sessions: tool + the first
// meaningful error line with the volatile parts (numbers, paths, hashes, quoted
// values) stripped out.
const signature = (tool, errorText) => {
    const line = String(errorText || '')
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !/^exit code \d+$/i.test(l)) || String(errorText || '').trim();
    const norm = redact(line)
        .replace(/(["'`]).*?\1/g, '<q>')
        .replace(/(?:\/[\w.@-]+)+\/?/g, '<path>')
        .replace(/\b[0-9a-f]{7,40}\b/gi, '<hash>')
        .replace(/\d+/g, '<n>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    return `${tool}: ${norm}`;
};

const contentText = (content) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map((b) => (b && b.type === 'text' ? b.text : '')).filter(Boolean).join('\n');
    }
    return '';
};

const summarizeInput = (name, input = {}) => {
    if (name === 'Bash') return clip(input.command, CAPS.command);
    if (input.file_path) return clip(input.file_path, CAPS.command);
    if (name === 'Skill') return clip(input.skill, 80);
    if (name === 'Agent') return clip(input.subagent_type || input.description, 80);
    if (input.pattern) return clip(input.pattern, CAPS.command);
    return clip(JSON.stringify(input), 120);
};

// The command "family" used to decide whether a later call retried an earlier one.
const family = (name, input = {}) => {
    if (name !== 'Bash') return `${name}:${input.file_path || ''}`;
    const words = String(input.command || '').replace(/^(cd \S+ &&\s*)+/, '').trim().split(/\s+/);
    return `Bash:${words.slice(0, 2).join(' ')}`;
};

// A git commit/push that skipped the husky gates. Only the command's first line is
// read, segment by segment, so a heredoc or a string that merely mentions the flag
// (docs, a hook's own help text) does not count.
const bypassesHooks = (command) => String(command || '')
    .split('\n')[0]
    .split(/&&|\|\||;/)
    .map((seg) => seg.trim())
    .some((seg) => /^git\s+(commit|push)\b/.test(seg) && /\s--no-verify\b/.test(seg));

const buildDigest = (lines, { event = null, projectDir = null } = {}) => {
    const toolUses = new Map();
    const calls = [];
    const toolCounts = {};
    const skills = new Set();
    const subagents = new Set();
    const files = new Set();
    const branches = new Set();
    const corrections = [];
    const hookErrors = [];
    let firstPrompt = null;
    let prompts = 0;
    let interrupts = 0;
    let noVerify = 0;
    let startedAt = null;
    let endedAt = null;
    let sessionId = null;
    let cost = null;

    const rel = (p) => (projectDir && p && p.startsWith(projectDir) ? path.relative(projectDir, p) : p);

    for (const raw of lines) {
        if (!raw || !raw.trim()) continue;
        let obj;
        try {
            obj = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        if (obj.isSidechain) continue;
        if (obj.sessionId && !sessionId) sessionId = obj.sessionId;
        if (obj.timestamp) {
            if (!startedAt) startedAt = obj.timestamp;
            endedAt = obj.timestamp;
        }
        if (obj.gitBranch) branches.add(obj.gitBranch);
        if (obj.type === 'cost-state') {
            cost = { usd: obj.totalCostUSD, durationMs: obj.totalDuration, apiMs: obj.totalAPIDuration };
        }
        if (obj.type === 'attachment' && obj.attachment && obj.attachment.type === 'hook_non_blocking_error') {
            hookErrors.push({ hook: obj.attachment.hookName, error: clip(firstLines(obj.attachment.stderr, 2), CAPS.text) });
        }

        const msg = obj.message;
        if (!msg) continue;

        if (obj.type === 'assistant' && Array.isArray(msg.content)) {
            for (const block of msg.content) {
                if (!block || block.type !== 'tool_use') continue;
                const call = { id: block.id, name: block.name, input: block.input || {}, ok: null };
                toolUses.set(block.id, call);
                calls.push(call);
                toolCounts[block.name] = (toolCounts[block.name] || 0) + 1;
                if (block.name === 'Skill' && call.input.skill) skills.add(call.input.skill);
                if (block.name === 'Agent') subagents.add(call.input.subagent_type || 'general-purpose');
                if (['Edit', 'Write', 'NotebookEdit'].includes(block.name) && call.input.file_path) files.add(rel(call.input.file_path));
                if (block.name === 'Bash' && bypassesHooks(call.input.command)) noVerify += 1;
            }
        }

        if (obj.type === 'user') {
            if (typeof msg.content === 'string' || (Array.isArray(msg.content) && !msg.content.some((b) => b && b.type === 'tool_result'))) {
                const text = contentText(msg.content);
                if (/\[Request interrupted by user/.test(text)) {
                    interrupts += 1;
                } else if (text.trim() && !obj.isMeta && !/^<(command|local-command|system-reminder)/.test(text.trim())) {
                    prompts += 1;
                    if (!firstPrompt) firstPrompt = clip(text, CAPS.text);
                    else if (CORRECTION_CUE.test(text) && corrections.length < CAPS.corrections) corrections.push(clip(text, CAPS.text));
                }
            }
            if (Array.isArray(msg.content)) {
                for (const block of msg.content) {
                    if (!block || block.type !== 'tool_result') continue;
                    const call = toolUses.get(block.tool_use_id);
                    if (!call) continue;
                    call.ok = !block.is_error;
                    if (block.is_error) call.error = contentText(block.content);
                    if (/\[Request interrupted by user/.test(contentText(block.content))) interrupts += 1;
                }
            }
        }
    }

    const errors = [];
    const permissionDenials = [];
    calls.forEach((call, idx) => {
        if (call.ok !== false) return;
        const entry = {
            tool: call.name,
            input: summarizeInput(call.name, call.input),
            error: clip(firstLines(call.error), CAPS.text),
            signature: signature(call.name, call.error),
        };
        if (PERMISSION_CUE.test(firstLines(call.error, 2))) {
            permissionDenials.push({ tool: entry.tool, input: entry.input, reason: entry.error });
            return;
        }
        // Did a later call in the same family succeed? That is the recovery worth learning.
        const fam = family(call.name, call.input);
        const later = calls.slice(idx + 1, idx + 15).find((c) => c.ok === true && family(c.name, c.input) === fam);
        if (later) entry.resolvedBy = summarizeInput(later.name, later.input);
        if (errors.length < CAPS.errors) errors.push(entry);
    });

    return {
        version: 1,
        sessionId,
        event,
        startedAt,
        endedAt,
        branches: [...branches],
        prompts,
        firstPrompt,
        toolCalls: toolCounts,
        skills: [...skills],
        subagents: [...subagents],
        filesTouched: [...files].slice(0, CAPS.files),
        errors,
        unresolvedErrors: errors.filter((e) => !e.resolvedBy).length,
        permissionDenials,
        interrupts,
        corrections,
        hookErrors,
        noVerify,
        cost,
    };
};

module.exports = {
    buildDigest, signature, redact, family, bypassesHooks,
};

if (require.main === module) {
    try {
        const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
        const transcript = input.transcript_path;
        if (!transcript || !fs.existsSync(transcript)) process.exit(0);
        const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
        const digest = buildDigest(fs.readFileSync(transcript, 'utf8').split('\n'), {
            event: input.hook_event_name || null,
            projectDir,
        });
        if (!digest.sessionId) digest.sessionId = input.session_id || 'unknown';
        const dir = process.env.THERR_DIGEST_DIR || path.join(projectDir, 'context', 'transcripts', 'digests');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${String(digest.sessionId).replace(/[^\w.-]/g, '_')}.json`);
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, `${JSON.stringify(digest, null, 2)}\n`);
        fs.renameSync(tmp, file);
    } catch (e) {
        // Fire and forget — never break the session.
    }
    process.exit(0);
}
