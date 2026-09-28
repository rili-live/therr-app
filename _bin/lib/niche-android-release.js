// Decision logic for releasing a niche Android app (niche/<TAG>-general → niche/<TAG>-main
// → Play). Pure functions only: the CLI in _bin/niche-android-release.js gathers the facts
// (git, EAS, CircleCI) and these decide what they mean, so the decisions are unit-testable
// without a network. Tests: _bin/lib/tests/niche-android-release.test.js.
//
// WHY THIS EXISTS
//
// A merge into niche/HABITS-main is what ships Friends with Habits: CircleCI's
// eas_build_habits_android job runs `eas build --auto-submit` and the AAB lands on the
// Play internal track as a draft. That job can fail without ever compiling anything — on
// 2026-09-25 (merge c13592e43, versionCode 50) it died because the EAS free-plan Android
// build quota was spent — and builds 46–49 had all been built and uploaded by hand for the
// same reason. Doing that by hand has two ways to go wrong that Play only reports after the
// upload attempt:
//
//   1. A versionCode that isn't new. Play rejects any versionCode <= one it has seen.
//   2. A local upload racing an EAS build of the same versionCode. Whichever lands second
//      is rejected, and if the EAS one is still queued you can't tell which it will be.
//
// So the rule these functions enforce: a local build happens only when nothing else is
// going to upload this versionCode.

// Niche apps whose release runs through a niche/<TAG>-main merge. The flagship Therr app
// releases from `main` (eas_build_therr_android) and is deliberately not here. Teem is
// shelved and has no CI job.
const NICHE_ANDROID_APPS = {
    HABITS: {
        brand: 'habits',
        brandVariation: 'HABITS',
        displayName: 'Friends with Habits',
        applicationId: 'com.therr.habits',
        easProfile: 'habits-internal',
        // `eas` resolves the project from TherrMobile/app.json in the working tree, so on a
        // checkout of another brand every EAS query silently answers for the wrong app.
        easProjectId: '59e59c96-e58a-4b93-bed5-d20ccdf395c2',
        ciJob: 'eas_build_habits_android',
        // The OU on the Friends with Habits upload key. Checked on the built AAB so a build
        // that fell back to another brand's key (the signingConfig prefix is chosen from
        // applicationId) is caught before Play rejects it.
        uploadCertOu: 'Friends with Habits',
        uploadKeyPropertyPrefix: 'HABITS',
    },
};

// EAS build statuses (as `eas build:list --json` reports them).
const EAS_ACTIVE = ['NEW', 'IN_QUEUE', 'IN_PROGRESS', 'PENDING_CANCEL'];
const EAS_FAILED = ['ERRORED', 'CANCELED'];

// A tag per locally uploaded versionCode, pushed to origin. EAS keeps its own record of
// the builds it made; this is the record for the ones it didn't.
const ledgerTagName = (app, versionCode) => `${app.brand}-android-vc${versionCode}`;
const LEDGER_TAG_RE = /-android-vc(\d+)$/;

const parseGradleVersion = (gradleText) => {
    const code = /^\s*versionCode\s+(\d+)\s*$/m.exec(gradleText || '');
    const name = /^\s*versionName\s+"([^"]+)"\s*$/m.exec(gradleText || '');
    const appId = /^\s*applicationId\s+"([^"]+)"\s*$/m.exec(gradleText || '');
    return {
        versionCode: code ? Number(code[1]) : null,
        versionName: name ? name[1] : null,
        applicationId: appId ? appId[1] : null,
    };
};

// Numeric dotted compare ("1.12.0" > "1.9.3"). Non-numeric segments compare as 0, which
// is fine for the X.Y.Z names this repo uses.
const compareVersionNames = (a, b) => {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d > 0 ? 1 : -1;
    }
    return 0;
};

// Is the candidate on niche/<TAG>-general a new release?
//
// candidate:     { versionCode, versionName } from build.gradle at the general tip
// mainTip:       { versionCode, versionName } from build.gradle at origin/niche/<TAG>-main
// mainHistory:   [{ versionCode, applicationId }] from build.gradle along main's first-parent
//                history. Only entries with the candidate's applicationId count: the niche
//                branch was forked from Therr's, so its older history carries Therr's
//                versionCodes (445+), which are a different Play app's and say nothing here.
// easBuilds:     [{ appBuildVersion, status }] for the app's EAS project
// ledgerTags:    versionCodes with a pushed ledger tag (local uploads)
// alreadyMerged: the general tip is already an ancestor of origin/niche/<TAG>-main
//
// status:
//   NEW              — not merged yet and the versionCode is above everything seen
//   MERGED_PENDING   — merged already, and no record of an upload yet (go watch CI)
//   ALREADY_RELEASED — merged and an EAS build or ledger tag already covers it
//   STALE            — not merged, but the versionCode/versionName wasn't bumped
const assessVersion = ({
    candidate, mainTip, mainHistory = [], easBuilds = [], ledgerTags = [], alreadyMerged,
    allowSameVersionName = false,
}) => {
    const blockers = [];
    const warnings = [];
    const vc = candidate.versionCode;

    if (!Number.isInteger(vc) || !candidate.versionName) {
        return { status: 'STALE', blockers: ['could not read versionCode/versionName from build.gradle'], warnings };
    }

    const liveEas = easBuilds.filter((b) => !EAS_FAILED.includes(b.status));
    const uploaded = new Set([
        ...liveEas.map((b) => Number(b.appBuildVersion)),
        ...ledgerTags.map(Number),
    ]);

    if (alreadyMerged) {
        if (uploaded.has(vc)) {
            return { status: 'ALREADY_RELEASED', blockers, warnings };
        }
        return { status: 'MERGED_PENDING', blockers, warnings };
    }

    const released = mainHistory
        .filter((h) => !candidate.applicationId || h.applicationId === candidate.applicationId)
        .map((h) => h.versionCode);
    const seen = [...released, ...uploaded].filter(Number.isInteger);
    const highest = seen.length ? Math.max(...seen) : null;
    if (highest !== null && vc <= highest) {
        blockers.push(`versionCode ${vc} is not new — ${highest} has already been released or built. `
            + `Bump versionCode in TherrMobile/android/app/build.gradle to at least ${highest + 1}.`);
    }

    if (mainTip && mainTip.versionName) {
        const cmp = compareVersionNames(candidate.versionName, mainTip.versionName);
        if (cmp < 0) {
            blockers.push(`versionName ${candidate.versionName} is lower than the released ${mainTip.versionName}.`);
        } else if (cmp === 0) {
            const msg = `versionName ${candidate.versionName} is unchanged from the last release — users can't tell `
                + 'the builds apart in a bug report.';
            if (allowSameVersionName) warnings.push(msg); else blockers.push(`${msg} Bump it, or pass --allow-same-version-name.`);
        }
    }

    return { status: blockers.length ? 'STALE' : 'NEW', blockers, warnings };
};

// The CircleCI job's failure log, reduced to why it failed.
const classifyCiFailure = (log) => {
    const text = String(log || '');
    if (/used its Android builds from the Free plan|Upgrade your plan for more builds/i.test(text)) {
        const reset = /reset in [^(]*\(on ([^)]+)\)/i.exec(text);
        return { reason: 'eas-quota', detail: `EAS free-plan Android build quota is spent${reset ? ` (resets ${reset[1]})` : ''}` };
    }
    if (/EXPO_TOKEN|not logged in|Unauthorized/i.test(text)) {
        return { reason: 'eas-auth', detail: 'EAS rejected the CI credentials (EXPO_TOKEN)' };
    }
    return { reason: 'ci-failed', detail: 'CI job failed for a reason other than EAS quota — read the log before building locally' };
};

// Given what CI and EAS say about a release merge, who is uploading this versionCode?
//
// ciState:   GitHub commit-status state for `ci/circleci: <job>` — null (not reported
//            yet), 'pending', 'success', 'failure' or 'error'
// easBuilds: EAS builds for this merge commit (or this versionCode)
// ciLog:     the failed step's output, when ciState is failure/error
// ledgerTag: a ledger tag for this versionCode already exists
//
// decision:
//   WAIT          — nothing decided yet; poll again
//   EAS_HANDLING  — an EAS build exists and is running; it will auto-submit
//   EAS_DONE      — an EAS build finished; it auto-submitted to Play
//   LOCAL_DONE    — a ledger tag says this was already uploaded locally
//   LOCAL_NEEDED  — nothing is going to upload this versionCode; build and submit locally
//
// An EAS build that exists always wins over the CI job's state: the job can be killed by
// its own no-output timeout after the build is registered, and the build (and its
// auto-submit) carries on server-side regardless.
const decideReleasePath = ({
    ciState, easBuilds = [], ciLog = '', ledgerTag = false,
}) => {
    if (ledgerTag) return { decision: 'LOCAL_DONE', reason: 'ledger-tag' };

    const active = easBuilds.find((b) => EAS_ACTIVE.includes(b.status));
    if (active) return { decision: 'EAS_HANDLING', reason: 'eas-build-active', build: active };
    const finished = easBuilds.find((b) => b.status === 'FINISHED');
    if (finished) return { decision: 'EAS_DONE', reason: 'eas-build-finished', build: finished };

    if (ciState === 'failure' || ciState === 'error') {
        const failedEas = easBuilds.find((b) => EAS_FAILED.includes(b.status));
        if (failedEas) {
            return {
                decision: 'LOCAL_NEEDED',
                reason: `eas-build-${failedEas.status.toLowerCase()}`,
                detail: 'the EAS build itself failed — read its log before building locally, it may fail the same way',
                build: failedEas,
            };
        }
        return { decision: 'LOCAL_NEEDED', ...classifyCiFailure(ciLog) };
    }

    if (ciState === 'success') {
        // The job's first step halts (green, no build) when HEAD^1..HEAD didn't touch
        // TherrMobile/ or therr-public-library/. A release merge carries a versionCode bump,
        // so this means the merge wasn't what we thought it was.
        return {
            decision: 'LOCAL_NEEDED',
            reason: 'ci-skipped',
            detail: 'CI went green without starting an EAS build — it judged the merge to have no mobile changes',
        };
    }

    return { decision: 'WAIT', reason: ciState ? `ci-${ciState}` : 'ci-not-reported' };
};

module.exports = {
    NICHE_ANDROID_APPS,
    EAS_ACTIVE,
    EAS_FAILED,
    LEDGER_TAG_RE,
    ledgerTagName,
    parseGradleVersion,
    compareVersionNames,
    assessVersion,
    classifyCiFailure,
    decideReleasePath,
};
