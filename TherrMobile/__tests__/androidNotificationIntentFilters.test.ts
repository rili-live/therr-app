import fs from 'fs';
import path from 'path';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

/**
 * Guards the coupling between the backend's push-notification click actions and the
 * Android manifest.
 *
 * push-notifications-service stamps `android.notification.clickAction` onto every FCM
 * display notification, using the per-brand strings in `AndroidIntentActions`
 * (therr-js-utilities). The Firebase SDK turns that into
 * `new Intent(action).setPackage(applicationId)`. When no activity declares the action,
 * the notification still posts — so nothing looks broken from the server side — but
 * tapping it does nothing at all.
 *
 * That is exactly how Friends with Habits shipped: the manifest hardcoded the
 * `app.therrmobile.*` (Therr) prefix while its backend sent `com.therr.mobile.habits.*`,
 * so not one notification on the app was tappable.
 *
 * These assertions read the real manifest and build.gradle rather than a copy, so they
 * fail if either the prefix mapping or the action list drifts from the enum again.
 *
 * The action-name list is intentionally duplicated here rather than imported from
 * therr-js-utilities: this suite has to keep working when the shared library's `lib/`
 * output is stale, and a literal list is what makes an accidental deletion from the
 * enum visible instead of silently shrinking the expectation set.
 */

const ANDROID_APP_DIR = path.resolve(__dirname, '../android/app');
const MANIFEST_PATH = path.join(ANDROID_APP_DIR, 'src/main/AndroidManifest.xml');
const BUILD_GRADLE_PATH = path.join(ANDROID_APP_DIR, 'build.gradle');

const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
const buildGradle = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');

// Every IntentActionKey in therr-js-utilities' PushNotifications module.
const INTENT_ACTION_KEYS = [
    'ACHIEVEMENT_COMPLETED',
    'CREATE_YOUR_PROFILE_REMINDER',
    'CREATE_A_MOMENT_REMINDER',
    'COMPLETE_DRAFT_REMINDER',
    'LATEST_POST_LIKES_STATS',
    'LATEST_POST_VIEWCOUNT_STATS',
    'NEW_AREAS_ACTIVATED',
    'NUDGE_SPACE_ENGAGEMENT',
    'POST_VISIT_REVIEW_REMINDER',
    'NEW_CONNECTION',
    'NEW_CONNECTION_REQUEST',
    'NEW_DIRECT_MESSAGE',
    'NEW_GROUP_MESSAGE',
    'NEW_GROUP_INVITE',
    'NEW_GROUP_MEMBERS',
    'NEW_LIKE_RECEIVED',
    'NEW_THOUGHT_REPLY_RECEIVED',
    'NEW_THOUGHT_REPOST_RECEIVED',
    'NEW_SUPER_LIKE_RECEIVED',
    'UNREAD_NOTIFICATIONS_REMINDER',
    'UNCLAIMED_ACHIEVEMENTS_REMINDER',
    'INVITE_FRIENDS_REMINDER',
    'REPORT_CONFIRMED',
    'LEADERBOARD_RANK_MILESTONE',
];

// The HABITS retention-loop keys (PACT_*, STREAK_*, PARTNER_*, ...) are deliberately not
// listed here. They exist in `HabitsAndroidIntentActions` but the Therr app does not handle
// habits pushes, so its manifest correctly declares no filter for them — asserting them on
// this branch would fail for the right reason. `niche/HABITS-general` carries that half.

const declaredActions = new Set(
    Array.from(manifest.matchAll(/<action android:name="([^"]+)"\s*\/>/g)).map((m) => m[1]),
);

describe('AndroidManifest push-notification intent filters', () => {
    it('declares an intent filter for every shared intent action key', () => {
        const missing = INTENT_ACTION_KEYS.filter(
            (key) => !declaredActions.has(`\${notificationActionPrefix}.${key}`),
        );

        expect(missing).toEqual([]);
    });

    it('uses the brand placeholder, never a hardcoded brand prefix, for notification actions', () => {
        // The app-shortcut actions are deliberately exempt: res/xml/shortcuts.xml cannot
        // expand manifest placeholders, so those two stay literal on every brand.
        const shortcutActions = ['app.therrmobile.QUICK_CREATE_MOMENT', 'app.therrmobile.QUICK_CREATE_THOUGHT'];
        const hardcoded = Array.from(declaredActions).filter(
            (action) => /^(app\.therrmobile|com\.therr\.mobile)\./.test(action)
                && !shortcutActions.includes(action),
        );

        expect(hardcoded).toEqual([]);
    });

    it('keeps the shortcut intent filters literal so res/xml/shortcuts.xml still resolves', () => {
        expect(declaredActions.has('app.therrmobile.QUICK_CREATE_MOMENT')).toBe(true);
        expect(declaredActions.has('app.therrmobile.QUICK_CREATE_THOUGHT')).toBe(true);
    });
});

/**
 * The list above is a literal, and that is deliberate — see the header. But a literal only
 * catches what it already names: a key *added* to the enum and never added here is
 * invisible, and the manifest assertions pass while the new notification ships untappable.
 * That is how `NEW_THOUGHT_REPOST_RECEIVED` sat uncovered on the HABITS branch.
 *
 * So close the loop against the enum's **TypeScript source**, read as text. Reading the
 * source rather than importing the module is what keeps the header's promise: it does not
 * care whether therr-js-utilities' `lib/` output has been built or is stale, and it holds
 * even though this suite must keep working when it has not been.
 *
 * `TherrAndroidIntentActions` is the enum checked here because it is the one the app this
 * branch builds actually receives. `niche/HABITS-general` runs the same guard against
 * `HabitsAndroidIntentActions`, which is a strict superset (41 keys against these 24) —
 * between the two branches every key is covered.
 */
const ENUM_SOURCE_PATH = path.resolve(
    __dirname,
    '../../therr-public-library/therr-js-utilities/src/constants/enums/PushNotifications.ts',
);

describe('intent action key list tracks the shared enum', () => {
    it('names every key in TherrAndroidIntentActions, and no key that is not in it', () => {
        const enumSource = fs.readFileSync(ENUM_SOURCE_PATH, 'utf8');
        const enumBlock = enumSource.match(/enum\s+TherrAndroidIntentActions\s*\{([\s\S]*?)\n\}/);

        // A rename or restructure of the enum must fail loudly here rather than quietly
        // reducing this test to an assertion about an empty set.
        expect(enumBlock).not.toBeNull();

        const enumKeys = Array.from(enumBlock![1].matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)).map((m) => m[1]);
        expect(enumKeys.length).toBeGreaterThan(0);

        // Named rather than counted so a failure says which key drifted.
        expect(enumKeys.filter((key) => !INTENT_ACTION_KEYS.includes(key))).toEqual([]);
        expect(INTENT_ACTION_KEYS.filter((key) => !enumKeys.includes(key))).toEqual([]);
    });
});

describe('build.gradle notificationActionPrefix placeholder', () => {
    it('defines the placeholder the manifest interpolates', () => {
        expect(buildGradle).toContain('notificationActionPrefix:');
    });

    it('maps the Habits applicationId to the prefix its backend actually sends', () => {
        // Deliberately not derived from applicationId: Habits ships as `com.therr.habits`
        // but publishes `com.therr.mobile.habits.*` actions.
        expect(buildGradle).toMatch(/'com\.therr\.habits':\s*'com\.therr\.mobile\.habits'/);
    });

    it('falls back to the Therr prefix for any unmapped applicationId', () => {
        expect(buildGradle).toMatch(/getOrDefault\(applicationId, 'app\.therrmobile'\)/);
    });

    it('resolves whatever applicationId this branch builds to the right prefix', () => {
        // Branch-agnostic on purpose: `general` builds Therr (app.therrmobile) and
        // `niche/HABITS-general` builds Friends with Habits (com.therr.habits), so
        // pinning one applicationId made this fail on the other branch. The invariant
        // that actually matters is unchanged — if applicationId moves to a value with
        // no matching entry and no correct fallback, the app silently reverts to Therr
        // actions and every notification becomes untappable again.
        const expectedPrefixByAppId: Record<string, string> = {
            'app.therrmobile': 'app.therrmobile', // falls through to getOrDefault
            'com.therr.habits': 'com.therr.mobile.habits',
            'com.therr.mobile.Teem': 'com.therr.mobile',
        };

        const applicationIdMatch = buildGradle.match(/applicationId "([^"]+)"/);
        expect(applicationIdMatch).not.toBeNull();

        const applicationId = applicationIdMatch![1];
        expect(Object.keys(expectedPrefixByAppId)).toContain(applicationId);

        const prefixEntry = buildGradle.match(
            new RegExp(`'${applicationId.replace(/\./g, '\\.')}':\\s*'([^']+)'`),
        );
        const resolvedPrefix = prefixEntry ? prefixEntry[1] : 'app.therrmobile';

        expect(resolvedPrefix).toBe(expectedPrefixByAppId[applicationId]);
    });
});
