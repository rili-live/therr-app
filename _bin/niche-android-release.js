#!/usr/bin/env node
// Release a niche Android app (today: Friends with Habits) to the Play internal track.
//
// The normal path is a merge of niche/<TAG>-general into niche/<TAG>-main, after which
// CircleCI's EAS job builds the AAB and auto-submits it. This script does that merge,
// watches whether EAS actually picks it up, and — only when nothing else is going to upload
// this versionCode — builds and submits the AAB from this machine instead. The decisions
// live in _bin/lib/niche-android-release.js; this file gathers the facts and acts.
//
// Driven by the /niche-android-release skill. Subcommands, in release order:
//
//   check                    is the versionCode/versionName on niche/<TAG>-general new?
//   merge [--dry-run]        merge niche/<TAG>-general into niche/<TAG>-main and push it
//   watch <merge-sha>        poll CI + EAS until it is clear who uploads this versionCode
//   build <merge-sha>        rebuild shared libs, bundleRelease, verify package/version/key
//   submit <merge-sha>       eas submit the local AAB, then push the ledger tag
//
// Common flags: --tag <TAG> (default: from the current niche/<TAG>-* branch), --json.
//
// Exit codes: 0 ok / nothing to do, 1 blocked or failed, 3 (watch only) local build needed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync, spawn } = require('child_process');
const {
    NICHE_ANDROID_APPS, EAS_ACTIVE, LEDGER_TAG_RE, ledgerTagName,
    parseGradleVersion, assessVersion, decideReleasePath,
} = require('./lib/niche-android-release');

const REPO = path.resolve(__dirname, '..');
const MOBILE = path.join(REPO, 'TherrMobile');
const GRADLE_FILE = 'TherrMobile/android/app/build.gradle';
const AAB_PATH = path.join(MOBILE, 'android/app/build/outputs/bundle/release/app-release.aab');
const MERGED_MANIFEST = path.join(MOBILE, 'android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml');
const NOTES_LOCALES = ['en-US', 'es-419', 'fr-CA'];
const SHARED_LIBS = ['therr-js-utilities', 'therr-styles', 'therr-react'];

// ---------------------------------------------------------------------------- utilities

const VALUE_OPTS = ['tag', 'timeout-min', 'interval-sec', 'log'];
const argv = process.argv.slice(2);
const opts = {};
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
    const m = /^--(.+)$/.exec(argv[i]);
    if (!m) positional.push(argv[i]);
    else if (VALUE_OPTS.includes(m[1])) { opts[m[1]] = argv[i + 1]; i += 1; } else opts[m[1]] = true;
}
const flag = (name) => opts[name] === true;
const opt = (name, fallback) => (typeof opts[name] === 'string' ? opts[name] : fallback);
const JSON_OUT = flag('json');

const log = (...m) => { if (!JSON_OUT) console.log(...m); };
const note = (...m) => console.error(...m);

class Blocked extends Error {}

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (...a) => spawnSync('git', a, { cwd: REPO, stdio: 'ignore' }).status === 0;
const gitShow = (ref, file) => {
    const r = spawnSync('git', ['show', `${ref}:${file}`], { cwd: REPO, encoding: 'utf8' });
    return r.status === 0 ? r.stdout : null;
};
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

const resolveApp = () => {
    let tag = opt('tag');
    if (!tag) {
        const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
        const m = /^niche\/([A-Z]+)-(general|main)$/.exec(branch);
        if (!m) throw new Blocked(`can't infer the app from branch "${branch}" — pass --tag HABITS`);
        [, tag] = m;
    }
    tag = tag.toUpperCase();
    const app = NICHE_ANDROID_APPS[tag];
    if (!app) throw new Blocked(`no niche Android release configured for ${tag} (known: ${Object.keys(NICHE_ANDROID_APPS).join(', ')})`);
    return {
        ...app,
        tag,
        generalBranch: `niche/${tag}-general`,
        mainBranch: `niche/${tag}-main`,
        originGeneral: `origin/niche/${tag}-general`,
        originMain: `origin/niche/${tag}-main`,
    };
};

const fetchBranches = (app) => {
    const refspecs = [
        `+refs/heads/${app.generalBranch}:refs/remotes/${app.originGeneral}`,
        `+refs/heads/${app.mainBranch}:refs/remotes/${app.originMain}`,
    ];
    git('fetch', '--quiet', 'origin', ...refspecs);
};

const versionAt = (ref) => parseGradleVersion(gitShow(ref, GRADLE_FILE));

const githubRepo = () => {
    const url = git('remote', 'get-url', 'origin');
    const m = /github\.com[:/]([^/]+)\/(.+?)(\.git)?$/.exec(url);
    if (!m) throw new Blocked(`origin is not a GitHub remote: ${url}`);
    return `${m[1]}/${m[2]}`;
};

// The working tree decides which EAS project `eas` talks to, and what Gradle builds.
const assertWorkingTreeBrand = (app) => {
    const brandConfig = fs.readFileSync(path.join(MOBILE, 'main/config/brandConfig.ts'), 'utf8');
    if (!new RegExp(`CURRENT_BRAND_VARIATION[^=]*=\\s*BrandVariations\\.${app.brandVariation}\\b`).test(brandConfig)) {
        throw new Blocked(`TherrMobile/main/config/brandConfig.ts is not ${app.brandVariation} — check out ${app.generalBranch} `
            + `(or run ./_bin/switch-brand.sh ${app.brand}) before releasing`);
    }
    const appJson = JSON.parse(fs.readFileSync(path.join(MOBILE, 'app.json'), 'utf8'));
    const projectId = appJson?.expo?.extra?.eas?.projectId || appJson?.extra?.eas?.projectId;
    if (projectId !== app.easProjectId) {
        throw new Blocked(`TherrMobile/app.json points EAS at project ${projectId}, not ${app.displayName} (${app.easProjectId})`);
    }
};

const easBuilds = (app, filters = []) => {
    const r = spawnSync('eas', ['build:list', '--platform', 'android', '--build-profile', app.easProfile,
        '--limit', '50', '--json', '--non-interactive', ...filters], { cwd: MOBILE, encoding: 'utf8' });
    if (r.error) throw new Blocked(`eas CLI not available (${r.error.message}) — npm install -g eas-cli`);
    const start = (r.stdout || '').indexOf('[');
    if (r.status !== 0 || start < 0) {
        throw new Blocked(`eas build:list failed — is \`eas whoami\` logged in?\n${(r.stderr || r.stdout || '').trim().slice(-800)}`);
    }
    return JSON.parse(r.stdout.slice(start)).map((b) => ({
        id: b.id,
        status: b.status,
        appVersion: b.appVersion,
        appBuildVersion: b.appBuildVersion,
        gitCommitHash: b.gitCommitHash,
        createdAt: b.createdAt,
        url: `https://expo.dev/accounts/${b.project?.ownerAccount?.name || '_'}/projects/${b.project?.slug || '_'}/builds/${b.id}`,
    }));
};

const easBuildsForRelease = (app, sha, versionCode) => {
    const byId = new Map();
    easBuilds(app, ['--git-commit-hash', sha]).forEach((b) => byId.set(b.id, b));
    easBuilds(app, ['--app-build-version', String(versionCode)]).forEach((b) => byId.set(b.id, b));
    return [...byId.values()];
};

const ledgerTags = (app) => {
    const out = git('ls-remote', '--tags', 'origin', `refs/tags/${app.brand}-android-vc*`);
    return out.split('\n').map((l) => LEDGER_TAG_RE.exec(l.replace(/\^\{\}$/, ''))).filter(Boolean).map((m) => Number(m[1]));
};

// The first commit on main's first-parent chain that contains `sha` — the merge that
// released it, and the commit CI built.
const findMergeCommit = (sha, mainRef) => {
    const out = git('rev-list', '--first-parent', '--ancestry-path', '--reverse', `${sha}..${mainRef}`);
    return out.split('\n')[0] || sha;
};

const mainHistoryVersionCodes = (mainRef) => {
    const shas = git('rev-list', '--first-parent', '-n', '300', mainRef, '--', GRADLE_FILE).split('\n').filter(Boolean);
    return shas.map((s) => versionAt(s).versionCode).filter(Number.isInteger);
};

// ---------------------------------------------------------------------------- check

const runCheck = (app) => {
    fetchBranches(app);
    assertWorkingTreeBrand(app);

    const blockers = [];
    const warnings = [];

    // The release is whatever origin has; a local branch that disagrees means what we'd
    // check isn't what we'd merge.
    const originSha = git('rev-parse', app.originGeneral);
    if (gitOk('rev-parse', '--verify', '--quiet', `refs/heads/${app.generalBranch}`)) {
        const localSha = git('rev-parse', app.generalBranch);
        if (localSha !== originSha) {
            if (gitOk('merge-base', '--is-ancestor', originSha, localSha)) {
                blockers.push(`${app.generalBranch} has unpushed commits — push it first so the release matches origin`);
            } else if (gitOk('merge-base', '--is-ancestor', localSha, originSha)) {
                warnings.push(`local ${app.generalBranch} is behind origin — releasing origin's tip ${originSha.slice(0, 9)}`);
            } else {
                blockers.push(`local ${app.generalBranch} and origin have diverged — reconcile before releasing`);
            }
        }
    }

    const candidate = versionAt(originSha);
    const mainTip = versionAt(app.originMain);
    if (candidate.applicationId !== app.applicationId) {
        blockers.push(`build.gradle applicationId on ${app.generalBranch} is ${candidate.applicationId}, expected ${app.applicationId} — `
            + 'the niche branch has been un-branded (run /split-branch-prs verify-brand)');
    }
    const alreadyMerged = gitOk('merge-base', '--is-ancestor', originSha, app.originMain);

    const assessment = assessVersion({
        candidate,
        mainTip,
        mainHistory: mainHistoryVersionCodes(app.originMain),
        easBuilds: easBuilds(app),
        ledgerTags: ledgerTags(app),
        alreadyMerged,
        allowSameVersionName: flag('allow-same-version-name'),
    });
    blockers.push(...assessment.blockers);
    warnings.push(...assessment.warnings);

    const missingNotes = NOTES_LOCALES.filter((l) => gitShow(originSha,
        `TherrMobile/fastlane/metadata/android/${l}/changelogs/${candidate.versionCode}.txt`) === null);
    if (missingNotes.length && assessment.status === 'NEW') {
        warnings.push(`no ${candidate.versionCode}.txt changelog for ${missingNotes.join(', ')} — Play users will see default.txt`);
    }

    const result = {
        app: app.displayName,
        applicationId: app.applicationId,
        generalSha: originSha,
        candidate: { versionCode: candidate.versionCode, versionName: candidate.versionName },
        released: { versionCode: mainTip.versionCode, versionName: mainTip.versionName },
        status: assessment.status,
        mergeSha: alreadyMerged ? findMergeCommit(originSha, app.originMain) : null,
        blockers,
        warnings,
    };

    log(`${app.displayName} — ${app.generalBranch} @ ${originSha.slice(0, 9)}`);
    log(`  candidate: ${candidate.versionName} (${candidate.versionCode})   last merged to ${app.mainBranch}: ${mainTip.versionName} (${mainTip.versionCode})`);
    log(`  status:    ${result.status}${result.mergeSha ? `  (merge ${result.mergeSha.slice(0, 9)})` : ''}`);
    blockers.forEach((b) => log(`  BLOCKER  ${b}`));
    warnings.forEach((w) => log(`  WARN     ${w}`));
    return result;
};

// ---------------------------------------------------------------------------- merge

const runMerge = (app) => {
    const check = runCheck(app);
    if (check.blockers.length) throw new Blocked('version check failed — not merging');
    if (check.status !== 'NEW') {
        log(`\nAlready merged as ${check.mergeSha} — nothing to merge. Next: watch ${check.mergeSha}`);
        return check;
    }

    // Unpushed local commits on niche/<TAG>-main would be orphaned by moving the ref.
    const localMain = `refs/heads/${app.mainBranch}`;
    if (gitOk('rev-parse', '--verify', '--quiet', localMain)
        && !gitOk('merge-base', '--is-ancestor', localMain, app.originMain)) {
        throw new Blocked(`local ${app.mainBranch} has commits origin doesn't — push or drop them first`);
    }

    // Build the merge without touching the working tree or the current branch.
    const mt = spawnSync('git', ['merge-tree', '--write-tree', app.originMain, check.generalSha], { cwd: REPO, encoding: 'utf8' });
    if (mt.status !== 0) {
        throw new Blocked(`${app.generalBranch} does not merge cleanly into ${app.mainBranch}:\n${mt.stdout.trim()}`);
    }
    const tree = mt.stdout.split('\n')[0].trim();
    const message = `Merge branch '${app.generalBranch}' into ${app.mainBranch}`;
    const mergeSha = git('commit-tree', tree, '-p', git('rev-parse', app.originMain), '-p', check.generalSha, '-m', message);

    if (flag('dry-run')) {
        log(`\n--dry-run: would push merge ${mergeSha} to ${app.mainBranch}`);
        return { ...check, mergeSha, pushed: false };
    }

    log(`\nPushing merge ${mergeSha.slice(0, 9)} to ${app.mainBranch} — this starts CircleCI ${app.ciJob}...`);
    // Non-forced: if origin moved since the fetch, the push is rejected rather than clobbering it.
    const push = spawnSync('git', ['push', 'origin', `${mergeSha}:refs/heads/${app.mainBranch}`], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] });
    if (push.status !== 0) throw new Blocked('push failed — nothing was released');

    // Keep the local branch in step unless it is checked out somewhere (then it needs a pull).
    if (git('worktree', 'list', '--porcelain').split('\n').includes(`branch ${localMain}`)) {
        check.warnings.push(`${app.mainBranch} is checked out in a worktree — \`git pull\` there to pick up the merge`);
    } else {
        git('update-ref', localMain, mergeSha);
    }
    log(`Pushed. Next: watch ${mergeSha}`);
    return { ...check, mergeSha, pushed: true };
};

// ---------------------------------------------------------------------------- watch

const circleFailureLog = async (targetUrl, repo) => {
    const job = /\/(\d+)(?:[?#].*)?$/.exec(targetUrl || '');
    if (!job) return '';
    const headers = process.env.CIRCLECI_TOKEN ? { 'Circle-Token': process.env.CIRCLECI_TOKEN } : {};
    try {
        const res = await fetch(`https://circleci.com/api/v1.1/project/github/${repo}/${job[1]}`, { headers });
        const data = await res.json();
        const failed = (data.steps || []).flatMap((s) => s.actions).filter((a) => a.status === 'failed' && a.output_url);
        const parts = await Promise.all(failed.map(async (a) => {
            const out = await (await fetch(a.output_url)).json();
            return out.map((o) => o.message).join('');
        }));
        return parts.join('\n');
    } catch (e) {
        note(`  (couldn't read the CircleCI log: ${e.message})`);
        return '';
    }
};

const ciStatus = (repo, sha, job) => {
    const r = spawnSync('gh', ['api', `repos/${repo}/commits/${sha}/status`], { encoding: 'utf8' });
    if (r.status !== 0) throw new Blocked(`gh api failed — is \`gh auth status\` logged in?\n${r.stderr.trim()}`);
    const s = JSON.parse(r.stdout).statuses.find((x) => x.context === `ci/circleci: ${job}`);
    return s ? { state: s.state, url: s.target_url } : { state: null, url: null };
};

const runWatch = async (app, shaArg) => {
    if (!shaArg) throw new Blocked('usage: watch <merge-sha>');
    const sha = git('rev-parse', shaArg);
    assertWorkingTreeBrand(app);
    const { versionCode, versionName } = versionAt(sha);
    const repo = githubRepo();
    const deadline = Date.now() + Number(opt('timeout-min', 45)) * 60000;
    const interval = Number(opt('interval-sec', 30)) * 1000;
    let last = '';

    log(`Watching ${app.ciJob} + EAS for ${app.displayName} ${versionName} (${versionCode}) @ ${sha.slice(0, 9)}`);
    // A poll loop: each iteration has to finish before the next is meaningful.
    /* eslint-disable no-await-in-loop */
    for (;;) {
        const ci = ciStatus(repo, sha, app.ciJob);
        const builds = easBuildsForRelease(app, sha, versionCode);
        const ledgerTag = ledgerTags(app).includes(versionCode);
        const ciLog = ci.state === 'failure' || ci.state === 'error' ? await circleFailureLog(ci.url, repo) : '';
        const d = decideReleasePath({
            ciState: ci.state, easBuilds: builds, ciLog, ledgerTag,
        });

        const line = `${d.decision} (${d.reason})${d.build ? ` EAS ${d.build.status}` : ''}  CI=${ci.state || 'not reported'}`;
        if (line !== last) { log(`  ${new Date().toLocaleTimeString()}  ${line}`); last = line; }

        const keepGoing = d.decision === 'WAIT' || (flag('until-finished') && d.decision === 'EAS_HANDLING');
        if (!keepGoing) {
            if (d.build) log(`  EAS build: ${d.build.url}`);
            if (ci.url) log(`  CI job:    ${ci.url}`);
            if (d.detail) log(`  ${d.detail}`);
            return {
                mergeSha: sha, versionCode, versionName, ciState: ci.state, ciUrl: ci.url, ...d,
            };
        }
        if (Date.now() > deadline) {
            throw new Blocked(`timed out still at ${line} — re-run watch, or check ${ci.url || 'CircleCI'} by hand`);
        }
        await sleep(interval);
    }
    /* eslint-enable no-await-in-loop */
};

// ---------------------------------------------------------------------------- build

const readProps = (file) => {
    try {
        return Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n')
            .map((l) => /^\s*([^#=\s]+)\s*=\s*(.*)$/.exec(l)).filter(Boolean)
            .map((m) => [m[1], m[2].trim()]));
    } catch (e) { return {}; }
};

// Nothing else may be about to upload this versionCode. Play rejects the second of two.
const assertNobodyElseUploads = (app, sha, versionCode) => {
    const live = easBuildsForRelease(app, sha, versionCode).find((b) => EAS_ACTIVE.includes(b.status) || b.status === 'FINISHED');
    if (live) throw new Blocked(`EAS build ${live.id} for versionCode ${versionCode} is ${live.status} — EAS is uploading it; don't build locally`);
    if (ledgerTags(app).includes(versionCode)) {
        throw new Blocked(`tag ${ledgerTagName(app, versionCode)} exists — versionCode ${versionCode} was already uploaded locally`);
    }
};

const verifyAab = (app, expected, builtAfter = 0) => {
    if (!fs.existsSync(AAB_PATH)) throw new Blocked(`no AAB at ${AAB_PATH} — run build first`);
    if (fs.statSync(AAB_PATH).mtimeMs < builtAfter) throw new Blocked('the AAB on disk predates this build — Gradle did not write it');
    const manifest = fs.readFileSync(MERGED_MANIFEST, 'utf8');
    const got = {
        applicationId: /package="([^"]+)"/.exec(manifest)?.[1],
        versionCode: Number(/android:versionCode="(\d+)"/.exec(manifest)?.[1]),
        versionName: /android:versionName="([^"]+)"/.exec(manifest)?.[1],
    };
    if (got.applicationId !== app.applicationId || got.versionCode !== expected.versionCode || got.versionName !== expected.versionName) {
        throw new Blocked(`built ${JSON.stringify(got)}, expected ${app.applicationId} ${expected.versionName} (${expected.versionCode})`);
    }
    // Not `jarsigner -verbose -certs`: it prints every entry (~1.5 MB for this AAB), which
    // overflows spawnSync's 1 MB buffer and reads as "unsigned".
    const signed = spawnSync('jarsigner', ['-verify', AAB_PATH], { encoding: 'utf8' });
    const cert = spawnSync('keytool', ['-printcert', '-jarfile', AAB_PATH], { encoding: 'utf8' });
    const ownerOu = /^Owner: .*\bOU=([^,]+)/m.exec(cert.stdout || '')?.[1];
    if (!/jar verified/.test(signed.stdout) || ownerOu !== app.uploadCertOu) {
        throw new Blocked(`AAB is not signed with the ${app.displayName} upload key (OU=${app.uploadCertOu}) — check the `
            + `${app.uploadKeyPropertyPrefix}_UPLOAD_* properties in ~/.gradle/gradle.properties`);
    }
    return {
        ...got, aab: AAB_PATH, bytes: fs.statSync(AAB_PATH).size, certSha256: /SHA256:\s*(\S+)/.exec(cert.stdout)?.[1],
    };
};

const runStep = (label, cmd, cmdArgs, cwd, env, logFile) => new Promise((resolve, reject) => {
    log(`  ${label}...`);
    const out = fs.openSync(logFile, 'a');
    fs.writeSync(out, `\n===== ${label}: ${cmd} ${cmdArgs.join(' ')} (${cwd})\n`);
    const child = spawn(cmd, cmdArgs, { cwd, env, stdio: ['ignore', out, out] });
    child.on('close', (code) => {
        fs.closeSync(out);
        if (code === 0) return resolve();
        const tail = fs.readFileSync(logFile, 'utf8').split('\n').slice(-40).join('\n');
        return reject(new Blocked(`${label} failed (exit ${code}). Last lines of ${logFile}:\n${tail}`));
    });
});

const runBuild = async (app, shaArg) => {
    if (!shaArg) throw new Blocked('usage: build <merge-sha>');
    const sha = git('rev-parse', shaArg);
    assertWorkingTreeBrand(app);
    const expected = versionAt(sha);

    // The AAB must be exactly the released commit's mobile + shared-library code.
    // Markdown never reaches the bundle, so a docs edit doesn't make the build unreproducible.
    const bundled = ['TherrMobile', 'therr-public-library', ':(exclude)*.md'];
    const drift = spawnSync('git', ['diff', '--quiet', sha, '--', ...bundled], { cwd: REPO }).status !== 0;
    const untracked = git('ls-files', '--others', '--exclude-standard', '--', ...bundled);
    if (drift || untracked) {
        throw new Blocked(`TherrMobile/ or therr-public-library/ in the working tree differs from ${sha.slice(0, 9)} — `
            + `check out ${app.generalBranch} at origin's tip and stash local changes, so the build is the release`);
    }

    const gsj = path.join(MOBILE, 'android/app/google-services.json');
    if (!fs.existsSync(gsj) || !fs.readFileSync(gsj, 'utf8').includes(`"${app.applicationId}"`)) {
        throw new Blocked(`TherrMobile/android/app/google-services.json is missing or has no client for ${app.applicationId}`);
    }
    const dotenv = readProps(path.join(MOBILE, '.env'));
    if (!dotenv.GOOGLE_APIS_ANDROID_KEY) throw new Blocked('TherrMobile/.env has no GOOGLE_APIS_ANDROID_KEY (react-native-dotenv fails the bundle without it)');
    const props = { ...readProps(path.join(MOBILE, 'android/gradle.properties')), ...readProps(path.join(os.homedir(), '.gradle/gradle.properties')) };
    if (!props[`${app.uploadKeyPropertyPrefix}_UPLOAD_STORE_FILE`]) {
        throw new Blocked(`${app.uploadKeyPropertyPrefix}_UPLOAD_STORE_FILE is not set in ~/.gradle/gradle.properties — the AAB would be unsigned`);
    }

    assertNobodyElseUploads(app, sha, expected.versionCode);

    const logFile = opt('log', path.join(os.tmpdir(), `${app.brand}-android-vc${expected.versionCode}-build.log`));
    fs.writeFileSync(logFile, '');
    log(`Building ${app.displayName} ${expected.versionName} (${expected.versionCode}) from ${sha.slice(0, 9)} — log: ${logFile}`);
    const started = Date.now();
    const env = { ...process.env, ...dotenv };

    // Metro bundles the compiled lib/ output, which is gitignored and only as fresh as the
    // last local build. EAS rebuilds it in eas-build-pre-install.sh; a local build must too.
    for (const lib of SHARED_LIBS) {
        // eslint-disable-next-line no-await-in-loop -- build order matters: therr-react imports the other two
        await runStep(`build ${lib}`, 'npm', ['run', 'build'], path.join(REPO, 'therr-public-library', lib), env, logFile);
    }
    await runStep('gradle :app:bundleRelease', './gradlew', [':app:bundleRelease'], path.join(MOBILE, 'android'), env, logFile);

    const verified = verifyAab(app, expected, started);
    log(`  built in ${Math.round((Date.now() - started) / 1000)}s: ${verified.applicationId} ${verified.versionName} (${verified.versionCode}), `
        + `${(verified.bytes / 1e6).toFixed(1)} MB, signed OU=${app.uploadCertOu}`);
    log(`  ${verified.aab}\nNext: submit ${sha}`);
    return { mergeSha: sha, ...verified, log: logFile };
};

// ---------------------------------------------------------------------------- submit

const runSubmit = (app, shaArg) => {
    if (!shaArg) throw new Blocked('usage: submit <merge-sha>');
    const sha = git('rev-parse', shaArg);
    assertWorkingTreeBrand(app);
    const expected = versionAt(sha);
    const verified = verifyAab(app, expected);
    assertNobodyElseUploads(app, sha, expected.versionCode);

    log(`Submitting ${app.displayName} ${expected.versionName} (${expected.versionCode}) to Play (${app.easProfile}: internal track, draft)...`);
    const submitArgs = ['submit', '--platform', 'android', '--profile', app.easProfile, '--path', verified.aab, '--non-interactive'];
    const r = spawnSync('eas', submitArgs, { cwd: MOBILE, encoding: 'utf8' });
    const output = `${r.stdout}\n${r.stderr}`;
    const submissionUrl = /Submission details:\s*(\S+)/.exec(output)?.[1] || null;
    if (r.status !== 0 || !/Submitted your app to Google Play/i.test(output)) {
        const dup = /version code[^\n]*already been used/i.test(output);
        throw new Blocked(`${dup ? `Play already has versionCode ${expected.versionCode}. ` : ''}eas submit failed:\n${output.trim().slice(-1500)}`);
    }

    // Ledger tag: the record that this versionCode was uploaded from a machine, not EAS.
    // A tag push carries no code and CircleCI has no tag filters, so the pre-push test gate
    // has nothing to check — skipping it is the legitimate exception.
    const tag = ledgerTagName(app, expected.versionCode);
    git('tag', '-a', tag, sha, '-m', `${app.displayName} ${expected.versionName} (${expected.versionCode}) — built locally, `
        + `uploaded to the Play internal track as a draft${submissionUrl ? `\n\nEAS submission: ${submissionUrl}` : ''}`);
    const pushed = spawnSync('git', ['push', '--no-verify', 'origin', `refs/tags/${tag}`], { cwd: REPO, encoding: 'utf8' });
    if (pushed.status !== 0) note(`  WARN: submitted, but pushing ledger tag ${tag} failed — push it by hand:\n${pushed.stderr}`);

    log(`  Submitted. ${submissionUrl || ''}\n  Ledger tag: ${tag}`);
    return {
        mergeSha: sha, versionCode: expected.versionCode, versionName: expected.versionName, submissionUrl, tag, tagPushed: pushed.status === 0,
    };
};

// ---------------------------------------------------------------------------- main

const main = async () => {
    const [cmd, sha] = positional;
    const app = resolveApp();
    let result;
    switch (cmd) {
        case 'check': result = runCheck(app); break;
        case 'merge': result = runMerge(app); break;
        case 'watch': result = await runWatch(app, sha); break;
        case 'build': result = await runBuild(app, sha); break;
        case 'submit': result = runSubmit(app, sha); break;
        default:
            throw new Blocked('usage: niche-android-release.js <check|merge|watch|build|submit> [merge-sha] [--tag HABITS] [--json]');
    }
    if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
    if (cmd === 'check' && result.blockers.length) return 1;
    if (cmd === 'watch' && result.decision === 'LOCAL_NEEDED') return 3;
    return 0;
};

main().then((code) => process.exit(code)).catch((e) => {
    if (JSON_OUT) console.log(JSON.stringify({ error: e.message }, null, 2));
    note(e instanceof Blocked ? `BLOCKED: ${e.message}` : (e.stack || e.message));
    process.exit(1);
});
