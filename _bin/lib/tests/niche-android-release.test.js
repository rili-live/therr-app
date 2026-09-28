// Tests for the niche Android release decisions: "is this versionCode new?" and "who is
// uploading it?".
//
// The incident: the Friends with Habits 1.12.0 (50) merge (c13592e43) went to
// niche/HABITS-main, and CircleCI's eas_build_habits_android failed without compiling
// anything because the EAS free-plan build quota was spent. It had failed the same way for
// builds 46–49, each built and uploaded by hand. A by-hand release can upload a versionCode
// Play has already seen, or race an EAS build that is only queued. Play rejects either one,
// and only after the upload.

const assert = require('assert');
const {
    NICHE_ANDROID_APPS, ledgerTagName, LEDGER_TAG_RE,
    parseGradleVersion, compareVersionNames, assessVersion, classifyCiFailure, decideReleasePath,
} = require('../niche-android-release');

let passed = 0;
const test = (name, fn) => {
    try {
        fn();
        passed += 1;
    } catch (e) {
        console.error(`✗ ${name}`);
        throw e;
    }
};

// ------------------------------------------------------------------ parsing

test('parses versionCode, versionName and applicationId from build.gradle', () => {
    const gradle = `
    defaultConfig {
        applicationId "com.therr.habits"
        minSdkVersion rootProject.ext.minSdkVersion
        // versionCode 12 in a comment must not win
        versionCode 50
        versionName "1.12.0"
    }`;
    assert.deepStrictEqual(parseGradleVersion(gradle), { versionCode: 50, versionName: '1.12.0', applicationId: 'com.therr.habits' });
});

test('missing gradle text parses to nulls rather than throwing', () => {
    assert.deepStrictEqual(parseGradleVersion(null), { versionCode: null, versionName: null, applicationId: null });
});

test('versionName compares numerically, not lexically', () => {
    assert.strictEqual(compareVersionNames('1.12.0', '1.9.3'), 1);
    assert.strictEqual(compareVersionNames('1.12', '1.12.0'), 0);
    assert.strictEqual(compareVersionNames('1.11.9', '1.12.0'), -1);
});

test('ledger tag names round-trip through the tag regex', () => {
    const tag = ledgerTagName(NICHE_ANDROID_APPS.HABITS, 51);
    assert.strictEqual(tag, 'habits-android-vc51');
    assert.strictEqual(LEDGER_TAG_RE.exec(`abc123\trefs/tags/${tag}`)[1], '51');
});

// ------------------------------------------------------------------ assessVersion

const HABITS_ID = 'com.therr.habits';
const history = (...codes) => codes.map((versionCode) => ({ versionCode, applicationId: HABITS_ID }));
const base = {
    candidate: { versionCode: 51, versionName: '1.13.0', applicationId: HABITS_ID },
    mainTip: { versionCode: 50, versionName: '1.12.0' },
    mainHistory: history(50, 49, 48),
    easBuilds: [{ appBuildVersion: '45', status: 'FINISHED' }],
    ledgerTags: [],
    alreadyMerged: false,
};

test('a bumped, unmerged release is NEW', () => {
    const r = assessVersion(base);
    assert.strictEqual(r.status, 'NEW');
    assert.deepStrictEqual(r.blockers, []);
});

test('an unbumped versionCode is STALE', () => {
    const r = assessVersion({ ...base, candidate: { ...base.candidate, versionCode: 50 } });
    assert.strictEqual(r.status, 'STALE');
    assert.match(r.blockers[0], /versionCode 50 is not new/);
});

test("Therr's versionCodes from before the niche fork don't count against the niche app", () => {
    // niche/HABITS-main's first-parent history reaches back past the fork from Therr, where
    // build.gradle still said app.therrmobile / 445. Counting it demanded versionCode 446 for
    // Friends with Habits, which sat at 50.
    const r = assessVersion({ ...base, mainHistory: [...history(50, 49), { versionCode: 445, applicationId: 'app.therrmobile' }] });
    assert.strictEqual(r.status, 'NEW');
});

test('a versionCode only EAS has seen still counts as released', () => {
    // An EAS build that never merged to main (someone ran `eas build` by hand) still
    // consumed the versionCode on Play.
    const r = assessVersion({ ...base, easBuilds: [{ appBuildVersion: '51', status: 'FINISHED' }] });
    assert.strictEqual(r.status, 'STALE');
});

test('an ERRORED EAS build did not consume its versionCode', () => {
    const r = assessVersion({ ...base, easBuilds: [{ appBuildVersion: '51', status: 'ERRORED' }] });
    assert.strictEqual(r.status, 'NEW');
});

test('a locally uploaded versionCode (ledger tag) counts as released', () => {
    const r = assessVersion({ ...base, ledgerTags: [52] });
    assert.strictEqual(r.status, 'STALE');
    assert.match(r.blockers[0], /at least 53/);
});

test('an unchanged versionName blocks unless explicitly allowed', () => {
    const same = { ...base, candidate: { ...base.candidate, versionName: '1.12.0' } };
    assert.strictEqual(assessVersion(same).status, 'STALE');
    const allowed = assessVersion({ ...same, allowSameVersionName: true });
    assert.strictEqual(allowed.status, 'NEW');
    assert.strictEqual(allowed.warnings.length, 1);
});

test('a lower versionName always blocks', () => {
    const r = assessVersion({ ...base, candidate: { ...base.candidate, versionName: '1.11.0' }, allowSameVersionName: true });
    assert.strictEqual(r.status, 'STALE');
});

test('already merged with no upload on record is MERGED_PENDING, not STALE', () => {
    // The 2026-09-25 state: 50 merged to main, CI failed, nothing uploaded yet. The
    // versionCode equals main's tip, which must not read as "not bumped".
    const r = assessVersion({ ...base, candidate: { ...base.candidate, versionCode: 50, versionName: '1.12.0' }, alreadyMerged: true });
    assert.strictEqual(r.status, 'MERGED_PENDING');
    assert.deepStrictEqual(r.blockers, []);
});

test('already merged and uploaded (EAS or ledger tag) is ALREADY_RELEASED', () => {
    const merged = { ...base, candidate: { ...base.candidate, versionCode: 50, versionName: '1.12.0' }, alreadyMerged: true };
    assert.strictEqual(assessVersion({ ...merged, easBuilds: [{ appBuildVersion: '50', status: 'IN_QUEUE' }] }).status, 'ALREADY_RELEASED');
    assert.strictEqual(assessVersion({ ...merged, ledgerTags: [50] }).status, 'ALREADY_RELEASED');
});

test('an unreadable build.gradle is a blocker, not a pass', () => {
    const r = assessVersion({ ...base, candidate: { versionCode: null, versionName: null } });
    assert.strictEqual(r.status, 'STALE');
});

// ------------------------------------------------------------------ CI failure classification

// Verbatim from CircleCI job 18409.
const QUOTA_LOG = 'This account has used its Android builds from the Free plan this month, which will reset in 5 days '
    + '(on Thu Oct 01 2026). Upgrade your plan for more builds with shorter wait times\n    Error: build command failed.';

test('the EAS free-plan quota failure is recognised, with its reset date', () => {
    const c = classifyCiFailure(QUOTA_LOG);
    assert.strictEqual(c.reason, 'eas-quota');
    assert.match(c.detail, /Thu Oct 01 2026/);
});

test('an unrecognised CI failure is not mistaken for quota', () => {
    assert.strictEqual(classifyCiFailure('Task :app:mergeReleaseResources FAILED').reason, 'ci-failed');
    assert.strictEqual(classifyCiFailure('').reason, 'ci-failed');
});

// ------------------------------------------------------------------ decideReleasePath

test('nothing reported yet means WAIT', () => {
    assert.strictEqual(decideReleasePath({ ciState: null }).decision, 'WAIT');
    assert.strictEqual(decideReleasePath({ ciState: 'pending' }).decision, 'WAIT');
});

test('a queued EAS build means EAS is handling it, even while CI is pending', () => {
    const d = decideReleasePath({ ciState: 'pending', easBuilds: [{ status: 'IN_QUEUE' }] });
    assert.strictEqual(d.decision, 'EAS_HANDLING');
});

test('an EAS build that exists beats a failed CI job (CLI killed by the no-output timeout)', () => {
    // The build is registered server-side at creation, so a killed CLI doesn't cancel it or
    // its auto-submit. Building locally here would race it for the same versionCode.
    const d = decideReleasePath({ ciState: 'failure', easBuilds: [{ status: 'IN_PROGRESS' }], ciLog: 'Too long with no output' });
    assert.strictEqual(d.decision, 'EAS_HANDLING');
});

test('a finished EAS build is EAS_DONE', () => {
    assert.strictEqual(decideReleasePath({ ciState: 'success', easBuilds: [{ status: 'FINISHED' }] }).decision, 'EAS_DONE');
});

test('CI failed on quota with no EAS build → LOCAL_NEEDED (eas-quota)', () => {
    const d = decideReleasePath({ ciState: 'failure', easBuilds: [], ciLog: QUOTA_LOG });
    assert.strictEqual(d.decision, 'LOCAL_NEEDED');
    assert.strictEqual(d.reason, 'eas-quota');
});

test('an EAS build that errored → LOCAL_NEEDED, flagged as a possible code failure', () => {
    const d = decideReleasePath({ ciState: 'failure', easBuilds: [{ status: 'ERRORED' }] });
    assert.strictEqual(d.decision, 'LOCAL_NEEDED');
    assert.strictEqual(d.reason, 'eas-build-errored');
});

test('CI green with no EAS build means the job skipped itself → LOCAL_NEEDED (ci-skipped)', () => {
    const d = decideReleasePath({ ciState: 'success', easBuilds: [] });
    assert.strictEqual(d.decision, 'LOCAL_NEEDED');
    assert.strictEqual(d.reason, 'ci-skipped');
});

test('a ledger tag means it was already uploaded locally, whatever CI says', () => {
    assert.strictEqual(decideReleasePath({ ciState: 'failure', ciLog: QUOTA_LOG, ledgerTag: true }).decision, 'LOCAL_DONE');
});

console.log(`niche-android-release: ${passed} passed`);
