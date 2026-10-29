#!/usr/bin/env node
// run-ledger — a resumable record of a multi-step skill run.
//
// Long skills (/split-branch-prs, /quality-peer-review, …) make decisions partway
// through that nothing outside the session records: how every file was classified,
// what the user confirmed, which branch and commit each step produced. When the
// session dies (a worker restart, a context compaction, a closed laptop), the next
// session had to start over and re-ask. This keeps those results on disk so the
// next session resumes at the first step it can't confirm.
//
// The ledger is a hint, never the truth. A skill resuming from it must re-check
// each recorded step against git or GitHub (does the commit exist on the branch,
// is the PR open) before skipping it. A step that can't be confirmed is redone.
//
// Stored under the git common dir (therr-runs/<skill>/<key>.json): per clone, shared
// by worktrees, survives a worker restart, never committed.
//
// Usage:
//   node scripts/run-ledger/index.js start <skill> <key> [--meta '<json>']
//       Opens a run, or prints the existing open run for <key> so it can be resumed.
//   node scripts/run-ledger/index.js step <skill> <key> <step> [--data '<json>']
//       Records <step> as done, with whatever the next session needs to verify and reuse it.
//   node scripts/run-ledger/index.js show [<skill>] [<key>] [--all]
//       Open runs (all runs with --all).
//   node scripts/run-ledger/index.js done <skill> <key>
//   node scripts/run-ledger/index.js abandon <skill> <key>
//
// Prints JSON. Exit 0 on success, 1 on a usage error or a missing run.
// Stdlib only.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SAFE = /^[A-Za-z0-9._/-]{1,200}$/;

const ledgerRoot = (cwd = process.cwd()) => {
    if (process.env.THERR_RUN_LEDGER_DIR) return process.env.THERR_RUN_LEDGER_DIR;
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' }).trim();
    return path.join(path.resolve(cwd, common), 'therr-runs');
};

// Keys are usually branch names (`feat/x`), so slashes are encoded rather than nested.
const fileFor = (root, skill, key) => path.join(root, skill, `${encodeURIComponent(key)}.json`);

const read = (file) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return null;
    }
};

const write = (file, run) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(run, null, 2)}\n`);
    fs.renameSync(tmp, file);
};

const now = () => new Date().toISOString();

const start = (root, skill, key, meta = {}) => {
    const file = fileFor(root, skill, key);
    const existing = read(file);
    if (existing && existing.status === 'open') return { resumed: true, run: existing };
    const run = {
        skill, key, status: 'open', startedAt: now(), updatedAt: now(), meta, steps: [],
    };
    write(file, run);
    return { resumed: false, run };
};

const step = (root, skill, key, name, data = {}) => {
    const file = fileFor(root, skill, key);
    const run = read(file);
    if (!run) throw new Error(`no run for ${skill} ${key} — start it first`);
    // Re-recording a step (a redo after verification failed) replaces it in place,
    // so the ledger never holds two answers for one step.
    run.steps = run.steps.filter((s) => s.name !== name);
    run.steps.push({ name, at: now(), data });
    run.updatedAt = now();
    write(file, run);
    return run;
};

const finish = (root, skill, key, status) => {
    const file = fileFor(root, skill, key);
    const run = read(file);
    if (!run) throw new Error(`no run for ${skill} ${key}`);
    run.status = status;
    run.updatedAt = now();
    write(file, run);
    return run;
};

const show = (root, skill, key, all = false) => {
    if (skill && key) {
        const run = read(fileFor(root, skill, key));
        return run ? [run] : [];
    }
    let skills = [];
    try {
        skills = skill ? [skill] : fs.readdirSync(root);
    } catch (e) {
        return [];
    }
    const runs = [];
    for (const s of skills) {
        let files = [];
        try {
            files = fs.readdirSync(path.join(root, s)).filter((f) => f.endsWith('.json'));
        } catch (e) {
            continue;
        }
        files.forEach((f) => {
            const run = read(path.join(root, s, f));
            if (run && (all || run.status === 'open')) runs.push(run);
        });
    }
    return runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

module.exports = {
    start, step, finish, show, ledgerRoot,
};

if (require.main === module) {
    const argv = process.argv.slice(2);
    const opt = (name) => {
        const i = argv.indexOf(name);
        if (i < 0) return undefined;
        const v = argv[i + 1];
        argv.splice(i, 2);
        return v;
    };
    const flag = (name) => {
        const i = argv.indexOf(name);
        if (i < 0) return false;
        argv.splice(i, 1);
        return true;
    };
    const parse = (json, what) => {
        if (json === undefined) return {};
        try {
            return JSON.parse(json);
        } catch (e) {
            throw new Error(`${what} is not valid JSON`);
        }
    };
    try {
        const meta = opt('--meta');
        const data = opt('--data');
        const all = flag('--all');
        const [cmd, skill, key, name] = argv;
        for (const v of [skill, key, name]) {
            if (v !== undefined && !SAFE.test(v)) throw new Error(`invalid name: ${v}`);
        }
        const root = ledgerRoot();
        let out;
        if (cmd === 'start' && skill && key) out = start(root, skill, key, parse(meta, '--meta'));
        else if (cmd === 'step' && skill && key && name) out = step(root, skill, key, name, parse(data, '--data'));
        else if (cmd === 'show') out = show(root, skill, key, all);
        else if (cmd === 'done' && skill && key) out = finish(root, skill, key, 'done');
        else if (cmd === 'abandon' && skill && key) out = finish(root, skill, key, 'abandoned');
        else throw new Error('usage: run-ledger start|step|show|done|abandon <skill> <key> [<step>] [--meta|--data <json>] [--all]');
        console.log(JSON.stringify(out, null, 2));
    } catch (e) {
        console.error(`run-ledger: ${e.message}`);
        process.exit(1);
    }
}
