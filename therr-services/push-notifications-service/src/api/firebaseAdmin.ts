import * as admin from 'firebase-admin';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import logSpan from 'therr-js-utilities/log-or-update-span';
import translate from '../utilities/translator';
import { clearInvalidDeviceToken } from '../handlers/helpers/user';
import { getCredentialEnvKey } from './firebaseCredentialEnvKey';
import { selectStreakAtRiskBodyKey } from './streakCopy';
import {
    formatHabitNames,
    selectCheckinNudgeBodyKey,
    shouldOfferOnePressCheckin,
} from './checkinNudgeCopy';

// FCM error codes for tokens that should be removed from the database.
// See https://firebase.google.com/docs/cloud-messaging/send-message#admin
const INVALID_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument', // FCM returns this when the token is malformed
]);

const isInvalidTokenError = (error: any): boolean => INVALID_TOKEN_ERROR_CODES.has(error?.code)
    || INVALID_TOKEN_ERROR_CODES.has(error?.errorInfo?.code);

// Brand → credential-env-key mapping lives in ./firebaseCredentialEnvKey so it can be
// imported by unit tests without triggering this module's startup-time validation.

const parseServiceAccount = (envKey: string, brandVariation: BrandVariations): admin.ServiceAccount | null => {
    const raw = process.env[envKey];
    if (!raw) {
        return null;
    }
    let parsed: any;
    try {
        parsed = JSON.parse(Buffer.from(raw, 'base64').toString());
    } catch (err: any) {
        throw new Error(
            `push-notifications-service: ${envKey} (${brandVariation}) is not valid base64-encoded JSON (${err?.message || 'parse error'}).`,
        );
    }
    if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) {
        throw new Error(
            `push-notifications-service: Firebase service account JSON for ${brandVariation} `
            + 'is missing required fields (project_id, client_email, private_key).',
        );
    }
    return parsed as admin.ServiceAccount;
};

// THERR credentials are required at startup (matches the historical
// single-app contract); absence is a hard failure so misconfigurations can't
// hide behind a fallback to a brand that doesn't exist.
const therrServiceAccount = parseServiceAccount(
    getCredentialEnvKey(BrandVariations.THERR),
    BrandVariations.THERR,
);
if (!therrServiceAccount) {
    throw new Error(
        'push-notifications-service: PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64 is not set. FCM cannot be initialized.',
    );
}

const defaultApp = admin.initializeApp({
    credential: admin.credential.cert(therrServiceAccount),
    // databaseURL: 'https://<DATABASE_NAME>.firebaseio.com',
});

// Cache of admin.app instances keyed by BrandVariations. Initialized lazily on
// first send for each brand: we don't know which brands are in use at boot,
// and eagerly initializing an app for every enum value would fail for brands
// whose env var isn't set in this environment. The fallback entry below
// ensures a brand without credentials still gets pushed (via the THERR/
// default app) rather than silently dropping the notification.
const brandAppCache = new Map<BrandVariations, admin.app.App>();
brandAppCache.set(BrandVariations.THERR, defaultApp);

// Which Firebase project each brand's sends actually resolve to. Populated
// alongside brandAppCache purely so the diagnostics endpoint can answer "is this
// brand sending through its own project, or falling back to Therr's?" without
// re-reading (and re-parsing) credentials. `admin.app.App.options.credential`
// does not expose project_id, so it has to be captured at parse time.
interface IBrandCredentialResolution {
    projectId: string;
    clientEmail: string;
    isFallbackToTherr: boolean;
}
const brandCredentialResolution = new Map<BrandVariations, IBrandCredentialResolution>();
brandCredentialResolution.set(BrandVariations.THERR, {
    projectId: (therrServiceAccount as any).project_id,
    clientEmail: (therrServiceAccount as any).client_email,
    isFallbackToTherr: false,
});

// Tracks brands we've already warned about falling back to the default app,
// so we don't spam the logs on every send to a brand whose env var is unset.
const brandsWithLoggedFallback = new Set<BrandVariations>();

const getAdminAppForBrand = (brandVariation: BrandVariations): admin.app.App => {
    const cached = brandAppCache.get(brandVariation);
    if (cached) return cached;

    const envKey = getCredentialEnvKey(brandVariation);
    const serviceAccount = parseServiceAccount(envKey, brandVariation);

    if (!serviceAccount) {
        if (!brandsWithLoggedFallback.has(brandVariation)) {
            brandsWithLoggedFallback.add(brandVariation);
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: [
                    `No Firebase credentials for brand ${brandVariation} (${envKey} not set) — falling back to default (THERR) Firebase app.`,
                ],
                traceArgs: {
                    'pushNotification.brandVariation': brandVariation,
                    'pushNotification.missingEnvKey': envKey,
                },
            });
        }
        // Cache the fallback so subsequent sends skip the env lookup.
        brandAppCache.set(brandVariation, defaultApp);
        brandCredentialResolution.set(brandVariation, {
            projectId: (therrServiceAccount as any).project_id,
            clientEmail: (therrServiceAccount as any).client_email,
            isFallbackToTherr: true,
        });
        return defaultApp;
    }

    const app = admin.initializeApp(
        { credential: admin.credential.cert(serviceAccount) },
        String(brandVariation), // name this admin app uniquely per brand
    );
    brandAppCache.set(brandVariation, app);
    brandCredentialResolution.set(brandVariation, {
        projectId: (serviceAccount as any).project_id,
        clientEmail: (serviceAccount as any).client_email,
        isFallbackToTherr: false,
    });
    return app;
};

interface ICreateMessageConfig {
    achievementsCount?: number;
    likeCount?: number;
    notificationsCount?: number;
    totalAreasActivated?: number;
    deviceToken: any;
    fromUserId?: string;
    fromUserName?: string;
    groupId?: string;
    groupName?: string;
    userId: string | string[];
    userLocale: string;
    viewCount?: number;
    groupMembersList?: string[],
    // HABITS payload fields. Streak / pact / habit copy is the entire HABITS
    // engagement story (see docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md §5);
    // generic copy converts noticeably worse than name-anchored copy.
    streakCount?: number;
    previousRecordDays?: number;
    partnerName?: string;
    pactId?: string;
    pactName?: string;
    habitId?: string;
    habitName?: string;
    // The habit goal a one-press check-in would complete. Distinct from
    // `habitName` (copy) and `habitId`: this is the id the device POSTs to
    // /habits/checkins, so it is only ever set when the notification names
    // exactly one habit.
    habitGoalId?: string;
    // Set by the digest's per-user roll-up. `habitCount > 1` means the nudge
    // covers several habits, which selects the plural copy AND suppresses the
    // check-in action — there is no single goal to complete.
    habitCount?: number;
    habitNames?: string[] | string;
    daysRemaining?: number;
    // The length of the cycle that just ended, in days — `pactEnded` copy names
    // it so the number the user sees is what they actually did, not a target.
    durationDays?: number;
    // Streak freezes. `freezesRemaining` is the count left after the spend and
    // also rides along on `streakAtRisk`, where it selects a body that names
    // the net instead of only naming the threat.
    freezesRemaining?: number;
    freezeDaysUsed?: number;
    // HABITS lifecycle payload (docs/HABIT_LIFECYCLE_MESSAGING.md). Mirrors the
    // fields users-service puts on the queue row in
    // `sendEmailAndOrPushNotification.ts` — age of the habit in days,
    // trailing-window consistency as a whole percent, and the user's best-ever
    // streak, which the comeback copy cites so it references a past success
    // rather than the present lapse.
    dayCount?: number;
    consistencyPercent?: number;
    bestStreakCount?: number;
    // Leaderboards: new weekly rank for rank-milestone copy
    rank?: number;
}

interface INotificationMetrics {
    lastMomentNotificationDate?: number | null;
    lastSpaceNotificationDate?: number | null;
}

// Must match the channel ids created on the mobile client in
// TherrMobile/main/constants/index.tsx (AndroidChannelIds). Without a matching
// channelId, Android 8+ will drop display-style notifications.
enum AndroidChannelId {
    default = 'default',
    contentDiscovery = 'contentDiscovery',
    rewardUpdates = 'rewardUpdates',
    reminders = 'reminders',
}

interface ICreateBaseMessage {
    data: { [key: string]: string; };
    deviceToken: any;
}

interface ICreateNotificationMessage extends ICreateBaseMessage {
    notificationTitle: string;
    notificationBody: string;
    channelId?: AndroidChannelId;
    // Required, with no default: a case that forgets it would address its
    // pushes to the wrong app, and nothing at runtime reports that.
    brandVariation: BrandVariations;
}

/**
 * The action buttons on a check-in nudge, as the JSON string Notifee's
 * background handler parses (`TherrMobile/index.js`).
 *
 * "Check In" is only offered when the notification names one habit goal — see
 * `shouldOfferOnePressCheckin`. When it does not, the user still gets a "View"
 * button rather than no buttons at all: the whole point of the roll-up is that
 * one notification can cover three habits, and the right destination then is
 * the list, not a guess.
 *
 * Android only. iOS renders the OS alert and cannot show these without a
 * Notification Service Extension — see the TODO(iOS-NSE) in
 * `createDataOnlyMessage`.
 */
const buildCheckinPressActions = (
    userLocale: string,
    config: ICreateMessageConfig,
): string => {
    const actions: { id: string; title: string; }[] = [];

    if (shouldOfferOnePressCheckin(config.habitGoalId, config.habitCount)) {
        actions.push({
            id: PushNotifications.PressActionIds.habitCheckin,
            title: translate(userLocale, 'notifications.shared.pressActionCheckIn'),
        });
    }

    actions.push({
        id: PushNotifications.PressActionIds.checkinView,
        title: translate(userLocale, 'notifications.shared.pressActionView'),
    });

    return JSON.stringify(actions);
};

/**
 * The action buttons on the "your pact ended" notification.
 *
 * This notification exists because of the fresh-start effect (Dai, Milkman &
 * Riis 2014): the end of a cycle is a temporal landmark, and a landmark is when
 * people will restart. The renew button is the whole reason the push is sent at
 * this moment rather than three days earlier — `isPactRenewable` is false until
 * the pact's window has passed, so the same button on `pactExpiring` would only
 * produce a rejected request.
 *
 * "Start New Cycle" is offered only when the payload names one pact, for the
 * same reason `buildCheckinPressActions` gates its check-in action: the id is
 * what the device sends to `PUT /habits/pacts/:id/renew`, and there is nothing
 * to renew without it. The View button is always present so the notification is
 * never a dead end.
 *
 * Android only — see the note in `buildCheckinPressActions`.
 */
const buildPactEndedPressActions = (
    userLocale: string,
    config: ICreateMessageConfig,
): string => {
    const actions: { id: string; title: string; }[] = [];

    if (config.pactId) {
        actions.push({
            id: PushNotifications.PressActionIds.pactRenew,
            title: translate(userLocale, 'notifications.shared.pressActionRenew'),
        });
    }

    actions.push({
        id: PushNotifications.PressActionIds.pactView,
        title: translate(userLocale, 'notifications.shared.pressActionView'),
    });

    return JSON.stringify(actions);
};

const getPostActionId = (postType?: string) => {
    let id = PushNotifications.PressActionIds.spaceView;

    if (postType === 'moments') {
        id = PushNotifications.PressActionIds.momentView;
    }
    if (postType === 'thoughts') {
        id = PushNotifications.PressActionIds.thoughtView;
    }
    return id;
};

interface IBrandAppIdentity {
    // The `apns-topic` header value for this brand's iOS pushes.
    //
    // APNS rejects any push whose `apns-topic` is not the receiving app's own
    // bundle id, and does so silently — FCM still accepts the send and
    // `messaging.send()` resolves with a message id, so nothing in our logs
    // distinguishes "delivered" from "dropped at APNS".
    //
    // CRITICAL: this must be a bundle id that an actual iOS target in
    // TherrMobile/ios/TherrMobile.xcodeproj builds, NOT the brand's Android
    // `applicationId` and not an aspirational id for an app that hasn't
    // shipped. A niche brand with no iOS target of its own runs as the Therr
    // binary (the niche branch only changes JS/brandConfig, not
    // PRODUCT_BUNDLE_IDENTIFIER), so its device tokens belong to
    // `com.therr.mobile.Therr` and its pushes must be addressed there.
    // `apnsTopicMatchesShippedIosTarget` in tests/unit/api/brandRouting.test.ts
    // pins every value here against the Xcode project.
    iosApnsTopic: string;
    // Android notification small-icon tint. Mirrors each app's primary accent
    // (see TherrMobile/main/styles/themes/brandConstants.ts on the
    // corresponding niche branch).
    accentColor: string;
    // The Android manifest must declare the exact action string or tapping the
    // notification is a silent no-op.
    intentActions: Record<string, string>;
}

// The only iOS bundle id this repo actually builds today — TherrMobile.xcodeproj
// has a single app target and every niche branch inherits it unchanged.
const THERR_IOS_BUNDLE_ID = 'com.therr.mobile.Therr';

const THERR_APP_IDENTITY: IBrandAppIdentity = {
    iosApnsTopic: THERR_IOS_BUNDLE_ID,
    accentColor: '#0f7b82',
    intentActions: PushNotifications.AndroidIntentActions.Therr,
};

// One row per brand, keyed exhaustively so that adding a value to
// `BrandVariations` fails to compile here rather than silently inheriting
// Therr's identity. Every field above fails invisibly in production when it is
// wrong, so a missing row must be a build error, not a runtime default.
const BRAND_APP_IDENTITIES: Record<BrandVariations, IBrandAppIdentity> = {
    [BrandVariations.THERR]: THERR_APP_IDENTITY,
    [BrandVariations.TEEM]: {
        // No `com.therr.mobile.Teem` iOS target exists (Teem is shelved), so its
        // iOS pushes must be addressed to the binary that actually receives them.
        iosApnsTopic: THERR_IOS_BUNDLE_ID,
        // Same value as Therr's: Teem's accent matches it. Intentional, not a placeholder.
        accentColor: '#0f7b82',
        intentActions: PushNotifications.AndroidIntentActions.Teem,
    },
    [BrandVariations.HABITS]: {
        // Friends with Habits ships its own *Android* app (applicationId
        // com.therr.habits) but has no iOS target: niche/HABITS-general changes
        // brandConfig.ts, app.json and build.gradle, and leaves
        // PRODUCT_BUNDLE_IDENTIFIER as com.therr.mobile.Therr. An iOS Habits
        // build is therefore the Therr binary running Habits JS, and its FCM
        // tokens are registered against the Therr iOS app.
        //
        // This previously read 'com.therr.mobile.habits' — a bundle id nothing
        // builds — which made APNS silently drop every data-only push to an iOS
        // Habits install while FCM still reported success. Android was
        // unaffected (it ignores the apns block), which is why the failure
        // looked like "iOS gets nothing, Android is fine".
        //
        // When Habits does ship an iOS target, change this in the same commit
        // that adds the target and registers the app in Firebase.
        iosApnsTopic: THERR_IOS_BUNDLE_ID,
        accentColor: '#1C7F8A',
        intentActions: PushNotifications.AndroidIntentActions.Habits,
    },
    // Brands with no mobile app of their own. Their users' device tokens are
    // registered against the Therr app, so they must keep Therr's identity —
    // give a brand its own row the moment it ships an app.
    [BrandVariations.APPY_SOCIAL]: THERR_APP_IDENTITY,
    [BrandVariations.PARALLELS]: THERR_APP_IDENTITY,
    [BrandVariations.OTAKU]: THERR_APP_IDENTITY,
    [BrandVariations.DASHBOARD_THERR]: THERR_APP_IDENTITY,
};

// `brandVariation` originates from an untrusted `x-brand-variation` header, so
// it can be a value outside the enum at runtime despite the type.
const getBrandAppIdentity = (brandVariation: BrandVariations): IBrandAppIdentity => BRAND_APP_IDENTITIES[brandVariation]
    || THERR_APP_IDENTITY;

/**
 * Notification types a brand must never receive, even though the type is
 * otherwise sendable.
 *
 * The whitelist below (`SENDABLE_NOTIFICATION_TYPES`) answers "does this type
 * work"; this answers "does this type belong to the app the user is holding".
 * They are separate questions because the senders are separate systems: the
 * retention pushes live in the sibling `therr-messaging-automator`
 * (docs/CROSS_REPO_INTEGRATION.md), which walks users per brand and has no
 * notion of which copy is on-brand for which app. A Friends with Habits user
 * receiving "Drop a moment at your favorite spot — your friends nearby will
 * discover it later!" is being advertised a different product, and the copy is
 * unfixable from here because it is correct for Therr.
 *
 * Excluded rather than deleted, and keyed per brand, because every type listed
 * here is the right notification on THERR/TEEM. Deliberately narrow: only copy
 * anchored to Therr's map / moment / space product. Cross-brand types
 * (`achievementCompleted`, `leaderboardRankMilestone`, connections, DMs,
 * groups, thoughts) stay allowed — Habits ships all of those surfaces.
 */
const BRAND_EXCLUDED_NOTIFICATION_TYPES: Partial<Record<BrandVariations, Set<PushNotifications.Types>>> = {
    [BrandVariations.HABITS]: new Set([
        PushNotifications.Types.createAMomentReminder,
        PushNotifications.Types.completeDraftReminder,
        PushNotifications.Types.newAreasActivated,
        PushNotifications.Types.nudgeSpaceEngagement,
        PushNotifications.Types.proximityRequiredMoment,
        PushNotifications.Types.proximityRequiredSpace,
        PushNotifications.Types.latestPostLikesStats,
        PushNotifications.Types.latestPostViewcountStats,
    ]),
};

/**
 * Types that belong to the Friends with Habits product and to no other app.
 *
 * These must never be sent under another brand, and the reason is stronger than
 * the deep link. `brandVariation` is what selects the recipient's device token
 * (`resolveDeviceTokenForBrand`, users-service), and a user who holds two branded
 * apps has a separate token per install — so a `streakAtRisk` push sent under
 * THERR is addressed to the user's *Therr* install and renders there, under
 * Therr's name and icon, on an app with no habits surface at all. The Habits app
 * gets nothing. It is the same "advertised a different product" failure
 * `BRAND_EXCLUDED_NOTIFICATION_TYPES` exists to prevent, in the other direction.
 *
 * This previously only warned and sent anyway, reasoning that "a broken deep link
 * beats no notification" — which held only if the push still reached the Habits
 * app. It does not. Blocking makes the real fault (a caller that lost its
 * `x-brand-variation` header — the gateway forwards it as `''` when absent, see
 * `handleServiceRequest.ts`, and `getBrandContext` then defaults to THERR)
 * visible as a routing failure instead of delivering to the wrong product.
 */
const HABITS_ONLY_TYPES: Set<PushNotifications.Types> = new Set([
    PushNotifications.Types.pactInvitation,
    PushNotifications.Types.pactNudge,
    PushNotifications.Types.pactAccepted,
    PushNotifications.Types.pactDeclined,
    PushNotifications.Types.pactCompleted,
    PushNotifications.Types.pactExpiring,
    PushNotifications.Types.pactEnded,
    PushNotifications.Types.partnerCheckedIn,
    PushNotifications.Types.partnerMissedDay,
    PushNotifications.Types.partnerCelebrated,
    PushNotifications.Types.streakMilestone,
    PushNotifications.Types.streakAtRisk,
    PushNotifications.Types.streakBroken,
    PushNotifications.Types.streakFreezeUsed,
    PushNotifications.Types.newPersonalRecord,
    PushNotifications.Types.dailyHabitReminder,
    PushNotifications.Types.morningMotivation,
    PushNotifications.Types.eveningCheckIn,
    PushNotifications.Types.habitEstablished,
    PushNotifications.Types.habitAutomaticity,
    PushNotifications.Types.habitMaintenanceCheckIn,
    PushNotifications.Types.habitComeback,
]);

export const isHabitsOnlyType = (type: PushNotifications.Types): boolean => HABITS_ONLY_TYPES.has(type);

export const isTypeAllowedForBrand = (
    type: PushNotifications.Types,
    brandVariation: BrandVariations,
): boolean => {
    if (isHabitsOnlyType(type) && brandVariation !== BrandVariations.HABITS) {
        return false;
    }
    return !BRAND_EXCLUDED_NOTIFICATION_TYPES[brandVariation]?.has(type);
};

const getApnsTopic = (brandVariation: BrandVariations) => getBrandAppIdentity(brandVariation).iosApnsTopic;

const getBrandAccentColor = (brandVariation: BrandVariations): string => getBrandAppIdentity(brandVariation).accentColor;

const getAppBrandingClickAction = (
    brandVariation: BrandVariations,
    clickActionKey: string,
) => getBrandAppIdentity(brandVariation).intentActions[clickActionKey];

export interface IBrandPushDiagnostics {
    brandVariation: string;
    credentialEnvKey: string;
    isCredentialEnvKeySet: boolean;
    // The Firebase project this brand's pushes are actually sent through.
    firebaseProjectId: string;
    // Masked — enough to tell two service accounts apart in a report, never enough to use.
    firebaseClientEmail: string;
    // True when the brand has no credentials of its own and rides the Therr app.
    // With a single shared Firebase project this is the *expected* state, not an error:
    // one service account can address every app registered in its own project.
    isFallbackToTherr: boolean;
    // What an iOS push for this brand would be addressed to. Must equal the
    // receiving build's PRODUCT_BUNDLE_IDENTIFIER or APNS drops it silently.
    iosApnsTopic: string;
    androidAccentColor: string;
    androidIntentActionSample: string;
}

const maskEmail = (email: string | undefined): string => {
    if (!email) return '';
    const [local, domain] = String(email).split('@');
    if (!domain) return '***';
    const head = local.slice(0, 6);
    // The domain is masked too, not just the local part. A Google service account
    // address is `<name>@<project-id>.iam.gserviceaccount.com`, so echoing the
    // domain verbatim reproduced a real, complete-looking service-account address
    // in the response — the one thing this endpoint promises never to return.
    // The suffix is kept because it is what identifies the value as a service
    // account at all; the leading label (the project id) is what gets dropped.
    // `firebaseProjectId` already reports the project deliberately and in the
    // clear, so nothing diagnostic is lost here.
    const domainLabels = domain.split('.');
    const maskedDomain = domainLabels.length > 1
        ? `***.${domainLabels.slice(1).join('.')}`
        : '***';
    return `${head}***@${maskedDomain}`;
};

// Describes how a brand's push would be routed, without sending anything.
// Initializing the admin app is idempotent and already cached, so this is safe
// to call repeatedly from a diagnostics endpoint.
const describeBrandPushRouting = (brandVariation: BrandVariations): IBrandPushDiagnostics => {
    const credentialEnvKey = getCredentialEnvKey(brandVariation);
    // Force resolution so the cache is populated for brands not yet used this process.
    getAdminAppForBrand(brandVariation);
    const resolution = brandCredentialResolution.get(brandVariation);
    const identity = getBrandAppIdentity(brandVariation);

    return {
        brandVariation: String(brandVariation),
        credentialEnvKey,
        isCredentialEnvKeySet: !!process.env[credentialEnvKey],
        firebaseProjectId: resolution?.projectId || '',
        firebaseClientEmail: maskEmail(resolution?.clientEmail),
        isFallbackToTherr: !!resolution?.isFallbackToTherr,
        iosApnsTopic: identity.iosApnsTopic,
        androidAccentColor: identity.accentColor,
        androidIntentActionSample: Object.values(identity.intentActions)[0] || '',
    };
};

export interface IRawSendResult {
    ok: boolean;
    messageId?: string;
    errorCode?: string;
    errorMessage?: string;
}

// Sends a message and *surfaces* the FCM outcome instead of swallowing it.
//
// predictAndSendNotification deliberately catches everything so a bad token can
// never fail the caller's request. That is right for production traffic and
// useless for debugging: the only signal it leaves is a log line. This variant
// exists for the diagnostics endpoint, which needs the raw FCM error code
// (`messaging/registration-token-not-registered`, `messaging/mismatched-credential`,
// `messaging/third-party-auth-error`, …) in the HTTP response.
//
// Note the limit of *any* FCM-level check: a successful messageId means FCM
// accepted the message, not that APNS or the device accepted it. An
// `apns-topic` that doesn't match the app is dropped after this point with no
// error, which is why describeBrandPushRouting reports the topic too.
const sendMessageForBrandRaw = (
    brandVariation: BrandVariations,
    message: admin.messaging.Message,
    dryRun = false,
): Promise<IRawSendResult> => getAdminAppForBrand(brandVariation)
    .messaging()
    .send(message, dryRun)
    .then((messageId) => ({ ok: true, messageId }))
    .catch((error) => ({
        ok: false,
        errorCode: error?.code || error?.errorInfo?.code || 'unknown',
        errorMessage: error?.message || String(error),
    }));

const createBaseMessage = (
    {
        data,
        deviceToken,
    }: ICreateBaseMessage,
): admin.messaging.Message | false => {
    const message: admin.messaging.Message = {
        data,
        // apns: {
        //     payload: {
        //         aps: {
        //             category: '', // apple apn category for click_action
        //         },
        //     },
        // },
        token: deviceToken,
    };

    return message;
};

const createDataOnlyMessage = (
    {
        data,
        deviceToken,
    }: ICreateBaseMessage,
    clickActionId: string,
    brandVariation: BrandVariations,
): admin.messaging.Message | false => {
    const baseMessage = createBaseMessage({
        data: {
            ...data,
            clickActionId,
        },
        deviceToken,
    });

    if (baseMessage === false) {
        return false;
    }

    // iOS: deliver as a visible APNS alert (push-type=alert, priority=10).
    //
    // The previous design sent these as iOS silent pushes
    // (push-type=background + content-available) and relied on a JS
    // setBackgroundMessageHandler to display the notification via Notifee. That
    // is unreliable on iOS: silent pushes never wake a killed app and can be
    // throttled under low power, so users frequently never saw anything.
    //
    // With an alert payload, iOS renders the notification natively in any app
    // state (foreground, backgrounded, or killed). The data payload still
    // arrives, so tapping the notification can be routed the same way as
    // before via the `notificationTitle` / `clickActionId` data fields. On
    // iOS foreground, the OS suppresses alerts by default, so `onMessage` in
    // Layout.tsx continues to fire and display via Notifee as it does today.
    //
    // Android is unaffected: it still receives a data-only payload (no `aps`
    // equivalent) and setBackgroundMessageHandler still converts it to a
    // Notifee notification with custom channel and action buttons.
    //
    // TODO(iOS-NSE): add an iOS Notification Service Extension so iOS can
    // match Android's custom action buttons (e.g. "Reply", "View") below the
    // alert. Without an NSE, the OS-rendered alert can only show title/body
    // and does not expose Notifee's android.actions to the user. The NSE
    // target would live in TherrMobile/ios/ as a separate bundle, read the
    // data payload, and call UNNotificationAttachment / UNNotificationAction
    // APIs. Tracked for a future PR — the data payload this function sends
    // already contains everything the NSE would need (notificationLinkPress-
    // Actions, notificationPressActionId, clickActionId).
    const iosTitle = typeof data.notificationTitle === 'string' ? data.notificationTitle : '';
    const iosBody = typeof data.notificationBody === 'string' ? data.notificationBody : '';
    baseMessage.apns = {
        payload: {
            aps: {
                alert: { title: iosTitle, body: iosBody },
                sound: 'default',
                mutableContent: true,
            },
        },
        headers: {
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'apns-topic': getApnsTopic(brandVariation),
        },
    };

    if (!baseMessage?.android) {
        baseMessage.android = {};
    }

    // Required for background/quit data-only messages on Android
    baseMessage.android.priority = 'high';

    return baseMessage;
};

const createNotificationMessage = ({
    data,
    deviceToken,
    notificationTitle,
    notificationBody,
    channelId = AndroidChannelId.default,
    brandVariation,
}: ICreateNotificationMessage): admin.messaging.Message | false => ({
    ...createBaseMessage({
        data,
        deviceToken,
    }),
    android: {
        notification: {
            icon: 'ic_notification_icon',
            color: getBrandAccentColor(brandVariation),
            // clickAction: 'app.therrmobile.VIEW_MOMENT',
            channelId,
        },
    },
    notification: {
        title: notificationTitle,
        body: notificationBody,
    },
    token: deviceToken,
});

const createMessage = (
    type: PushNotifications.Types,
    data: PushNotifications.INotificationData,
    config: ICreateMessageConfig,
    brandVariation: BrandVariations = BrandVariations.THERR,
): admin.messaging.Message | false => {
    let baseMessage: any = {};
    const modifiedData: any = {
        type,
        timestamp: Date.now().toString(), // values must be strings!
    };
    // FCM's `data` map is string->string, and firebase-admin enforces it client
    // side: `validateMessage` throws "data must only contain string values" for
    // ANY non-string value, before the message reaches Google.
    //
    // This loop used to copy every non-object value through verbatim, which is
    // wrong for exactly the values that reach it in practice. The callers build
    // their `data` literal with a fixed key set (`area`, `groupId`, `postType`,
    // `thought`, ...) and simply leave the irrelevant ones `undefined` — and
    // `typeof undefined` is 'undefined', not 'object', so those keys arrived
    // here as real `undefined` values and failed the whole send. Numbers had
    // the same problem. Because `predictAndSendNotification` swallows the throw
    // and the route still answered 201, the queue then recorded the row as
    // 'sent': 77 pushes were discarded this way in one 30-day window against 19
    // that actually went out.
    //
    // So: drop null/undefined rather than forwarding them, and coerce whatever
    // is left to a string.
    Object.keys(data).forEach((key) => {
        const value = data[key];
        if (value === null || value === undefined) {
            return;
        }
        modifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    });

    // Routing identifiers, promoted from `config` into the FCM data map.
    //
    // `config` is the *copy* payload — it never reaches the device. Everything
    // the client needs to act on a notification has to be in `data`, and these
    // three were not: `pactId` and `habitGoalId` were carried all the way from
    // the producer, used to render the body, and then dropped. That is why
    // tapping a habits notification could only ever open a list — the payload
    // named no destination — and it is what the one-press check-in needs, since
    // the action POSTs `habitGoalId` to /habits/checkins.
    //
    // Set here rather than per case so a new habits type inherits routing for
    // free, and only when present: FCM rejects a data map holding undefined
    // (see the coercion loop above), and an empty string is a value the client
    // would have to special-case.
    const routingIds: Record<string, unknown> = {
        habitGoalId: config.habitGoalId,
        pactId: config.pactId,
        habitCount: config.habitCount,
        // Not an identifier, but the renewal flow needs it for the same reason
        // the ids are here: the confirmation names the cycle it is about to
        // start ("another 30 days"), and a plan that states its own when is
        // what the implementation-intention literature finds effective. The
        // server re-reads the real value from the pact when renewing, so this
        // is display-only and a stale one cannot create a wrong cycle.
        durationDays: config.durationDays,
    };
    Object.keys(routingIds).forEach((key) => {
        const value = routingIds[key];
        if (value !== null && value !== undefined && value !== '') {
            modifiedData[key] = String(value);
        }
    });

    switch (type) {
        // Automation
        case PushNotifications.Types.createYourProfileReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.createYourProfileReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.createYourProfileReminder.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'CREATE_YOUR_PROFILE_REMINDER');
            return baseMessage;
        case PushNotifications.Types.createAMomentReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.createAMomentReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.createAMomentReminder.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'CREATE_A_MOMENT_REMINDER');
            return baseMessage;
        case PushNotifications.Types.completeDraftReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.completeDraftReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.completeDraftReminder.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'COMPLETE_DRAFT_REMINDER');
            return baseMessage;
        case PushNotifications.Types.latestPostLikesStats:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.latestPostLikesStats.title'),
                notificationBody: translate(config.userLocale, 'notifications.latestPostLikesStats.body', {
                    likeCount: config.likeCount || 0,
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'LATEST_POST_LIKES_STATS');
            return baseMessage;
        case PushNotifications.Types.latestPostViewcountStats:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.latestPostViewcountStats.title'),
                    notificationBody: translate(config.userLocale, 'notifications.latestPostViewcountStats.body', {
                        viewCount: config.viewCount || 0,
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.momentView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'LATEST_POST_VIEWCOUNT_STATS'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.unreadNotificationsReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.unreadNotificationsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.unreadNotificationsReminder.body', {
                    notificationsCount: config.notificationsCount || 0,
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'UNREAD_NOTIFICATIONS_REMINDER');
            return baseMessage;
        case PushNotifications.Types.unclaimedAchievementsReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.unclaimedAchievementsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.unclaimedAchievementsReminder.body', {
                    achievementsCount: config.achievementsCount || 0,
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'UNCLAIMED_ACHIEVEMENTS_REMINDER');
            return baseMessage;
        case PushNotifications.Types.inviteFriendsReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.inviteFriendsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.inviteFriendsReminder.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'INVITE_FRIENDS_REMINDER');
            return baseMessage;

        // Event Driven
        case PushNotifications.Types.achievementCompleted:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.achievementCompleted.title'),
                notificationBody: translate(config.userLocale, 'notifications.achievementCompleted.body'),
                channelId: AndroidChannelId.rewardUpdates,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'ACHIEVEMENT_COMPLETED');
            return baseMessage;
        case PushNotifications.Types.connectionRequestAccepted:
            // Expects modifiedData.fromUser = { id: ..., userName };
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.connectionRequestAccepted.title'),
                    notificationBody: translate(config.userLocale, 'notifications.connectionRequestAccepted.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.userView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.dmReplyToMsg,
                            title: translate(config.userLocale, 'notifications.connectionRequestAccepted.pressActionMessage'),
                        },
                        {
                            id: PushNotifications.PressActionIds.userView,
                            title: translate(config.userLocale, 'notifications.connectionRequestAccepted.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_CONNECTION'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.newConnectionRequest:
            // Expects modifiedData.fromUser = { id: ..., userName };
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newConnectionRequest.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newConnectionRequest.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.userView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.userAcceptConnectionRequest,
                            title: translate(config.userLocale, 'notifications.newConnectionRequest.pressActionAccept'),
                        },
                        {
                            id: PushNotifications.PressActionIds.userView,
                            title: translate(config.userLocale, 'notifications.newConnectionRequest.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_CONNECTION_REQUEST'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.newDirectMessage:
            // Expects modifiedData.fromUser = { id: ..., userName };
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newDirectMessage.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newDirectMessage.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.dmView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.dmView,
                            title: translate(config.userLocale, 'notifications.newDirectMessage.pressActionView'),
                        },
                        {
                            id: PushNotifications.PressActionIds.dmReplyToMsg,
                            title: translate(config.userLocale, 'notifications.newDirectMessage.pressActionReply'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_DIRECT_MESSAGE'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.newGroupMessage:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newGroupMessage.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newGroupMessage.body', {
                        groupName: String(config.groupName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.groupView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.groupView,
                            title: translate(config.userLocale, 'notifications.newGroupMessage.pressActionView'),
                        },
                        {
                            id: PushNotifications.PressActionIds.groupReplyToMsg,
                            title: translate(config.userLocale, 'notifications.newGroupMessage.pressActionReply'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_GROUP_MESSAGE'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.newGroupMembers:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.newGroupMembers.title'),
                notificationBody: translate(config.userLocale, 'notifications.newGroupMembers.body', {
                    groupName: String(config.groupName || ''),
                    members: String(config.groupMembersList?.slice(0, 3).join(', ') || ''),
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'NEW_GROUP_MEMBERS');
            return baseMessage;
        case PushNotifications.Types.newGroupInvite:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.newGroupInvite.title'),
                notificationBody: translate(config.userLocale, 'notifications.newGroupInvite.body', {
                    groupName: String(config.groupName || ''),
                    fromUserName: String(config.fromUserName || ''),
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'NEW_GROUP_INVITE');
            return baseMessage;
        case PushNotifications.Types.newLikeReceived:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newLikeReceived.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newLikeReceived.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: getPostActionId(modifiedData?.postType),
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: getPostActionId(modifiedData?.postType),
                            title: translate(config.userLocale, 'notifications.newLikeReceived.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_LIKE_RECEIVED'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.newSuperLikeReceived:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newSuperLikeReceived.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newSuperLikeReceived.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: getPostActionId(modifiedData?.postType),
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: getPostActionId(modifiedData?.postType),
                            title: translate(config.userLocale, 'notifications.newSuperLikeReceived.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_SUPER_LIKE_RECEIVED'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.newAreasActivated:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.newAreasActivated.title'),
                notificationBody: translate(config.userLocale, 'notifications.newAreasActivated.body', {
                    totalAreasActivated: Number(config.totalAreasActivated || 0),
                }),
                channelId: AndroidChannelId.contentDiscovery,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'NEW_AREAS_ACTIVATED');
            return baseMessage;
        // TODO: Make this a data-only message and test
        // Implement Notifee local push notification on from-end
        case PushNotifications.Types.nudgeSpaceEngagement:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.nudgeSpaceEngagement.title'),
                    notificationBody: translate(config.userLocale, 'notifications.nudgeSpaceEngagement.body'),
                    notificationPressActionId: PushNotifications.PressActionIds.nudge,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.nudge,
                            title: translate(config.userLocale, 'notifications.nudgeSpaceEngagement.pressActionCheckIn'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NUDGE_SPACE_ENGAGEMENT'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.proximityRequiredMoment:
            return createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueMoment.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueMoment.body'),
                channelId: AndroidChannelId.contentDiscovery,
            });
        case PushNotifications.Types.proximityRequiredSpace:
            return createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueSpace.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueSpace.body'),
                channelId: AndroidChannelId.contentDiscovery,
            });
        case PushNotifications.Types.newThoughtReplyReceived:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newThoughtReplyReceived.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newThoughtReplyReceived.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.thoughtView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.thoughtView,
                            title: translate(config.userLocale, 'notifications.newThoughtReplyReceived.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_THOUGHT_REPLY_RECEIVED'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.newThoughtRepostReceived:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newThoughtRepostReceived.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newThoughtRepostReceived.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.thoughtView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.thoughtView,
                            title: translate(config.userLocale, 'notifications.newThoughtRepostReceived.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_THOUGHT_REPOST_RECEIVED'), brandVariation);
            return baseMessage;

        // HABITS — Streak framing & pact lifecycle.
        // These notifications are HABITS' core retention loop. Loss-aversion
        // copy ("Don't break your N-day streak") and partner-anchored copy
        // ("Sam just hit Day N — don't let them lap you") consistently
        // out-perform generic reminders for habit apps.
        case PushNotifications.Types.streakAtRisk: {
            // Loss aversion, but stated inside the rule the app actually plays
            // by. Warning that a streak is on the line while quietly holding a
            // freeze that covers tonight teaches the user the threat is
            // overstated; naming the freeze is what makes "build in the miss" a
            // rule agreed in advance rather than a surprise.
            const atRiskFreezesRemaining = Number(config.freezesRemaining || 0);
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.streakAtRisk.title'),
                    notificationBody: translate(
                        config.userLocale,
                        // The digest rolls a user's whole day into one nudge, so
                        // this can now cover several habits at once. The plural
                        // body drops the freeze clause: a freeze count is
                        // per-habit and means nothing spread across three.
                        selectCheckinNudgeBodyKey(
                            type,
                            config.habitCount,
                            selectStreakAtRiskBodyKey(atRiskFreezesRemaining),
                        ),
                        {
                            streakCount: Number(config.streakCount || 0),
                            habitName: String(config.habitName || ''),
                            habitCount: Number(config.habitCount || 1),
                            habitNames: formatHabitNames(config.habitNames),
                            freezesRemaining: atRiskFreezesRemaining,
                        },
                    ),
                    notificationPressActionId: PushNotifications.PressActionIds.checkinView,
                    notificationLinkPressActions: buildCheckinPressActions(config.userLocale, config),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'STREAK_AT_RISK'), brandVariation);
            return baseMessage;
        }
        case PushNotifications.Types.streakFreezeUsed:
            // A real notification rather than data-only: this one is worth a
            // tray entry the user can come back to. It is the only moment the
            // safety net is visible, and it lands on a day the user did nothing
            // wrong, so it must read as reassurance and not as a warning.
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.streakFreezeUsed.title'),
                notificationBody: translate(config.userLocale, 'notifications.streakFreezeUsed.body', {
                    streakCount: Number(config.streakCount || 0),
                    habitName: String(config.habitName || ''),
                    freezesRemaining: Number(config.freezesRemaining || 0),
                }),
                channelId: AndroidChannelId.reminders,
            });
            return baseMessage;
        case PushNotifications.Types.streakBroken:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.streakBroken.title'),
                notificationBody: translate(config.userLocale, 'notifications.streakBroken.body', {
                    streakCount: Number(config.streakCount || 0),
                    habitName: String(config.habitName || ''),
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'STREAK_BROKEN');
            return baseMessage;
        case PushNotifications.Types.leaderboardRankMilestone:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.leaderboardRankMilestone.title'),
                    notificationBody: translate(config.userLocale, 'notifications.leaderboardRankMilestone.body', {
                        rank: Number(config.rank || 0),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.leaderboardView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'LEADERBOARD_RANK_MILESTONE'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.streakMilestone:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.streakMilestone.title'),
                    notificationBody: translate(config.userLocale, 'notifications.streakMilestone.body', {
                        streakCount: Number(config.streakCount || 0),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.streakView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'STREAK_MILESTONE'), brandVariation);
            return baseMessage;
        // HABITS — Lifecycle transitions (docs/HABIT_LIFECYCLE_MESSAGING.md).
        //
        // These deliberately reuse the STREAK_MILESTONE / STREAK_BROKEN intent
        // actions rather than declaring four of their own. A new IntentActionKey
        // is only half a deep link — the other half is an <intent-filter> in the
        // mobile AndroidManifest, which lives on `niche/HABITS-general` and can
        // never ship from here. Declaring keys with no manifest entry would give
        // Android a clickAction it cannot resolve, so the notification would open
        // nothing. The destinations are already right: the three celebrations
        // want the streak view, and the comeback wants the same "start a new
        // one" surface `streakBroken` already opens.
        case PushNotifications.Types.habitEstablished:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.habitEstablished.title', {
                        habitName: String(config.habitName || ''),
                    }),
                    notificationBody: translate(config.userLocale, 'notifications.habitEstablished.body', {
                        consistencyPercent: Number(config.consistencyPercent || 0),
                        dayCount: Number(config.dayCount || 0),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.streakView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'STREAK_MILESTONE'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.habitAutomaticity:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.habitAutomaticity.title'),
                    notificationBody: translate(config.userLocale, 'notifications.habitAutomaticity.body', {
                        dayCount: Number(config.dayCount || 0),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.streakView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'STREAK_MILESTONE'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.habitMaintenanceCheckIn:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.habitMaintenanceCheckIn.title', {
                        dayCount: Number(config.dayCount || 0),
                    }),
                    notificationBody: translate(config.userLocale, 'notifications.habitMaintenanceCheckIn.body', {
                        habitName: String(config.habitName || ''),
                        consistencyPercent: Number(config.consistencyPercent || 0),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.streakView,
                    // A maintenance check-in asks "are you still doing this?" —
                    // answering it from the tray is the cheapest possible yes.
                    notificationLinkPressActions: buildCheckinPressActions(config.userLocale, config),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'STREAK_MILESTONE'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.habitComeback:
            // A notification, not data-only: the comeback is the one lifecycle
            // message aimed at someone who has stopped opening the app, so it
            // has to render even when the app never wakes to handle it.
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.habitComeback.title', {
                    habitName: String(config.habitName || ''),
                }),
                notificationBody: translate(config.userLocale, 'notifications.habitComeback.body', {
                    bestStreakCount: Number(config.bestStreakCount || 0),
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'STREAK_BROKEN');
            return baseMessage;
        case PushNotifications.Types.newPersonalRecord:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newPersonalRecord.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newPersonalRecord.body', {
                        streakCount: Number(config.streakCount || 0),
                        previousRecordDays: Number(config.previousRecordDays || 0),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.streakView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_PERSONAL_RECORD'), brandVariation);
            return baseMessage;
        // The three `partner*` titles interpolate {partnerName}. `translate`
        // only substitutes params it is handed (see
        // therr-js-utilities/src/localization.ts), so calling it without them —
        // as all three of these did — shipped the literal braces to the
        // notification tray: "{partnerName} Just Checked In".
        case PushNotifications.Types.partnerCheckedIn: {
            const checkedInPartnerName = String(config.partnerName || config.fromUserName || '');
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.partnerCheckedIn.title', {
                        partnerName: checkedInPartnerName,
                    }),
                    notificationBody: translate(config.userLocale, 'notifications.partnerCheckedIn.body', {
                        partnerName: checkedInPartnerName,
                        streakCount: Number(config.streakCount || 0),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                    // "don't let them lap you" is a call to check in, so the
                    // notification should let the user do exactly that. The
                    // action only renders when the payload named one habit goal.
                    notificationLinkPressActions: buildCheckinPressActions(config.userLocale, config),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PARTNER_CHECKED_IN'), brandVariation);
            return baseMessage;
        }
        case PushNotifications.Types.partnerMissedDay: {
            const missedDayPartnerName = String(config.partnerName || config.fromUserName || '');
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.partnerMissedDay.title', {
                        partnerName: missedDayPartnerName,
                    }),
                    notificationBody: translate(config.userLocale, 'notifications.partnerMissedDay.body', {
                        partnerName: missedDayPartnerName,
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PARTNER_MISSED_DAY'), brandVariation);
            return baseMessage;
        }
        case PushNotifications.Types.partnerCelebrated: {
            const celebratedPartnerName = String(config.partnerName || config.fromUserName || '');
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.partnerCelebrated.title', {
                        partnerName: celebratedPartnerName,
                    }),
                    notificationBody: translate(config.userLocale, 'notifications.partnerCelebrated.body', {
                        partnerName: celebratedPartnerName,
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PARTNER_CELEBRATED'), brandVariation);
            return baseMessage;
        }
        case PushNotifications.Types.pactInvitation:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.pactInvitation.title'),
                    notificationBody: translate(config.userLocale, 'notifications.pactInvitation.body', {
                        userName: String(config.fromUserName || ''),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.pactAccept,
                            title: translate(config.userLocale, 'notifications.pactInvitation.pressActionAccept'),
                        },
                        {
                            id: PushNotifications.PressActionIds.pactView,
                            title: translate(config.userLocale, 'notifications.pactInvitation.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PACT_INVITATION'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.pactNudge:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.pactNudge.title'),
                    notificationBody: translate(config.userLocale, 'notifications.pactNudge.body', {
                        partnerName: String(config.partnerName || config.fromUserName || ''),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.pactAccept,
                            title: translate(config.userLocale, 'notifications.pactNudge.pressActionAccept'),
                        },
                        {
                            id: PushNotifications.PressActionIds.pactView,
                            title: translate(config.userLocale, 'notifications.pactNudge.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PACT_NUDGE'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.pactAccepted:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.pactAccepted.title'),
                    notificationBody: translate(config.userLocale, 'notifications.pactAccepted.body', {
                        partnerName: String(config.partnerName || config.fromUserName || ''),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PACT_ACCEPTED'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.pactDeclined:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.pactDeclined.title'),
                notificationBody: translate(config.userLocale, 'notifications.pactDeclined.body', {
                    partnerName: String(config.partnerName || config.fromUserName || ''),
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'PACT_DECLINED');
            return baseMessage;
        case PushNotifications.Types.pactCompleted:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.pactCompleted.title'),
                    notificationBody: translate(config.userLocale, 'notifications.pactCompleted.body', {
                        habitName: String(config.habitName || ''),
                        partnerName: String(config.partnerName || config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PACT_COMPLETED'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.pactExpiring:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.pactExpiring.title'),
                    notificationBody: translate(config.userLocale, 'notifications.pactExpiring.body', {
                        daysRemaining: Number(config.daysRemaining || 0),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PACT_EXPIRING'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.pactEnded:
            // Data-only so the renew button can exist at all: Android renders
            // action buttons from Notifee, and Notifee only sees a message that
            // arrives as data. Same constraint that moved `dailyHabitReminder`
            // off the display path.
            //
            // DEPLOY ORDER: an installed app that does not yet declare the
            // PACT_ENDED intent action ignores this entirely, and one that
            // declares it but has no handler for `renew-pact` opens the app
            // without renewing. Neither errors. Ship the niche/HABITS-general
            // half before this reaches production traffic.
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.pactEnded.title', {
                        habitName: String(config.habitName || ''),
                    }),
                    notificationBody: translate(config.userLocale, 'notifications.pactEnded.body', {
                        durationDays: Number(config.durationDays || 0),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                    notificationLinkPressActions: buildPactEndedPressActions(config.userLocale, config),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PACT_ENDED'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.dailyHabitReminder:
            // Data-only, where this used to be an OS-rendered notification.
            // Action buttons are the reason: Android renders them from Notifee,
            // and Notifee only ever sees a message that arrives as data
            // (`TherrMobile/index.js` matches on `clickActionId`). A reminder
            // the user can satisfy from the tray is the whole point of the
            // change, and it cannot be done on the display path.
            //
            // DEPLOY ORDER: the channel now comes from the client's
            // `getAndroidChannelFromClickActionId` instead of the `channelId`
            // named here, so `DAILY_HABIT_REMINDER` must be in
            // `REMINDER_ACTION_KEYS` (TherrMobile/main/constants/index.tsx,
            // niche/HABITS-general) or an installed app posts this on the
            // DEFAULT-importance "General" channel with no heads-up banner.
            // Ship the mobile release first.
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.dailyHabitReminder.title'),
                    notificationBody: translate(
                        config.userLocale,
                        selectCheckinNudgeBodyKey(type, config.habitCount, 'notifications.dailyHabitReminder.body'),
                        {
                            habitName: String(config.habitName || ''),
                            habitCount: Number(config.habitCount || 1),
                            habitNames: formatHabitNames(config.habitNames),
                        },
                    ),
                    notificationPressActionId: PushNotifications.PressActionIds.checkinView,
                    notificationLinkPressActions: buildCheckinPressActions(config.userLocale, config),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'DAILY_HABIT_REMINDER'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.morningMotivation:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.morningMotivation.title'),
                notificationBody: translate(config.userLocale, 'notifications.morningMotivation.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'MORNING_MOTIVATION');
            return baseMessage;
        case PushNotifications.Types.eveningCheckIn:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.eveningCheckIn.title'),
                notificationBody: translate(config.userLocale, 'notifications.eveningCheckIn.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'EVENING_CHECK_IN');
            return baseMessage;

        default:
            return false;
    }
};

// TODO: RDATA-3 - Add machine learning to predict whether to send push notification
/**
 * The types this service will actually hand to FCM.
 *
 * This replaces a ~120-line `if (type === X) return messaging.send(message)`
 * chain that did nothing but test membership. It is a whitelist, not a
 * formality: a type with a `createMessage` case but no entry here is built and
 * then dropped, so keeping the two in sync is the difference between a
 * notification existing and a notification being sent.
 *
 * `postVisitReviewReminder` and `reportConfirmed` are deliberately absent —
 * they have no `createMessage` case either, so they are rejected one step
 * earlier, with `unsupported-notification-type`.
 */
const SENDABLE_NOTIFICATION_TYPES: Set<PushNotifications.Types> = new Set([
    PushNotifications.Types.achievementCompleted,
    PushNotifications.Types.completeDraftReminder,
    PushNotifications.Types.connectionRequestAccepted,
    PushNotifications.Types.createAMomentReminder,
    PushNotifications.Types.createYourProfileReminder,
    PushNotifications.Types.dailyHabitReminder,
    PushNotifications.Types.eveningCheckIn,
    PushNotifications.Types.habitAutomaticity,
    PushNotifications.Types.habitComeback,
    PushNotifications.Types.habitEstablished,
    PushNotifications.Types.habitMaintenanceCheckIn,
    PushNotifications.Types.inviteFriendsReminder,
    PushNotifications.Types.latestPostLikesStats,
    PushNotifications.Types.latestPostViewcountStats,
    PushNotifications.Types.leaderboardRankMilestone,
    PushNotifications.Types.morningMotivation,
    PushNotifications.Types.newAreasActivated,
    PushNotifications.Types.newConnectionRequest,
    PushNotifications.Types.newDirectMessage,
    PushNotifications.Types.newGroupInvite,
    PushNotifications.Types.newGroupMembers,
    PushNotifications.Types.newGroupMessage,
    PushNotifications.Types.newLikeReceived,
    PushNotifications.Types.newPersonalRecord,
    PushNotifications.Types.newSuperLikeReceived,
    PushNotifications.Types.newThoughtReplyReceived,
    PushNotifications.Types.newThoughtRepostReceived,
    PushNotifications.Types.nudgeSpaceEngagement,
    PushNotifications.Types.pactAccepted,
    PushNotifications.Types.pactCompleted,
    PushNotifications.Types.pactDeclined,
    PushNotifications.Types.pactEnded,
    PushNotifications.Types.pactExpiring,
    PushNotifications.Types.pactInvitation,
    PushNotifications.Types.pactNudge,
    PushNotifications.Types.partnerCelebrated,
    PushNotifications.Types.partnerCheckedIn,
    PushNotifications.Types.partnerMissedDay,
    PushNotifications.Types.proximityRequiredMoment,
    PushNotifications.Types.proximityRequiredSpace,
    PushNotifications.Types.streakAtRisk,
    PushNotifications.Types.streakBroken,
    PushNotifications.Types.streakFreezeUsed,
    PushNotifications.Types.streakMilestone,
    PushNotifications.Types.unclaimedAchievementsReminder,
    PushNotifications.Types.unreadNotificationsReminder,
]);

// Keeps the two log call sites below from drifting apart, and keeps the four
// strings greppable in one place — docs/PUSH_NOTIFICATIONS_DEBUGGING.md quotes
// the real-send pair verbatim in its `gcloud logging read` query.
const dryRunAwareLogMessage = (ok: boolean, isDryRun: boolean): string => {
    if (isDryRun) {
        return ok ? 'Push dry run validated' : 'Push dry run rejected';
    }
    return ok ? 'Push successfully sent' : 'Push not sent';
};

export interface IPredictAndSendOptions {
    // Ask FCM to validate the message (credentials, envelope, token) without
    // delivering it. Exists so a post-deploy check can exercise *this* function
    // — the one production uses — rather than `sendMessageForBrandRaw`, which
    // builds a different envelope and skips the SENDABLE_NOTIFICATION_TYPES gate
    // below. See docs/PUSH_NOTIFICATIONS_DEBUGGING.md § Known sharp edges: a
    // green raw-path check ran throughout the August 2026 outage because the
    // envelope it validated was not the envelope production sends.
    dryRun?: boolean;
}

const predictAndSendNotification = (
    type: PushNotifications.Types,
    data: PushNotifications.INotificationData,
    config: ICreateMessageConfig,
    metrics: INotificationMetrics | undefined,
    brandVariation: BrandVariations,
    headers?: InternalConfigHeaders,
    options?: IPredictAndSendOptions,
): Promise<IRawSendResult> => {
    const isDryRun = !!options?.dryRun;
    const message = createMessage(type, data, config, brandVariation);
    // Route sends through the brand's own Firebase project so FCM delivery
    // uses the correct APNS auth key / FCM credentials for this brand.
    const messaging = getAdminAppForBrand(brandVariation).messaging();

    if (isHabitsOnlyType(type) && brandVariation !== BrandVariations.HABITS) {
        // Blocked below by isTypeAllowedForBrand — see HABITS_ONLY_TYPES. Logged at
        // error rather than warn because this is never benign: the brand picks the
        // device token, so the only reason a habits type arrives under another brand
        // is a producer that lost its `x-brand-variation` header, and the user
        // silently gets this notification in the wrong app (or, now, not at all).
        // The trace args are what identify that producer.
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['HABITS-only notification arrived under a non-HABITS brand — not routed. Caller lost x-brand-variation.'],
            traceArgs: {
                'pushNotification.type': String(type),
                'pushNotification.brandVariation': String(brandVariation),
                'user.id': config.userId,
                // Whatever the caller did send, so the producer is identifiable from
                // one log line rather than by correlating timestamps.
                'request.brandVariationHeader': String(headers?.['x-brand-variation'] ?? ''),
                'request.userIdHeader': String(headers?.['x-userid'] ?? ''),
            },
        });
    }

    return Promise.resolve()
        .then((): Promise<IRawSendResult> => {
            if (!isTypeAllowedForBrand(type, brandVariation)) {
                return Promise.resolve({
                    ok: false,
                    errorCode: 'notification-type-not-routed-for-brand',
                    errorMessage: `Type "${type}" is excluded for brand "${brandVariation}"`,
                });
            }

            if (!message) {
                // No case in createMessage — nothing would ever be sent for this
                // type. Previously this returned undefined and the route still
                // answered 201, so the caller recorded a delivery.
                return Promise.resolve({
                    ok: false,
                    errorCode: 'unsupported-notification-type',
                    errorMessage: `createMessage returned false for type "${type}"`,
                });
            }

            if (!SENDABLE_NOTIFICATION_TYPES.has(type)) {
                return Promise.resolve({
                    ok: false,
                    errorCode: 'notification-type-not-routed',
                    errorMessage: `Type "${type}" has a createMessage case but is not in SENDABLE_NOTIFICATION_TYPES`,
                });
            }

            return messaging.send(message, isDryRun).then((messageId) => ({ ok: true, messageId }));
        })
        .then((result: IRawSendResult) => {
            logSpan({
                level: result.ok ? 'info' : 'error',
                messageOrigin: 'API_SERVER',
                // Dry runs get their own wording on purpose. The runbook's
                // delivery-rate query greps for "Push successfully sent" /
                // "Push not sent", and a post-deploy check firing on every
                // release would otherwise show up as production traffic.
                messages: [dryRunAwareLogMessage(result.ok, isDryRun)],
                traceArgs: {
                    'pushNotification.dryRun': isDryRun,
                    'pushNotification.ok': result.ok,
                    'error.code': result.errorCode,
                    'error.message': result.errorMessage,
                    'pushNotification.type': String(type),
                    'pushNotification.messageData': message && message.data,
                    'pushNotification.messageNotification': message && message.notification,
                    'user.id': config.userId,
                    'pushNotification.lastMomentNotificationDate': metrics?.lastMomentNotificationDate,
                    'pushNotification.lastSpaceNotificationDate': metrics?.lastSpaceNotificationDate,
                },
            });

            return result;
        })
        .catch((error) => {
            const fcmErrorCode = error?.code || error?.errorInfo?.code;
            const tokenInvalid = isInvalidTokenError(error);
            const targetUserId = typeof config.userId === 'string' ? config.userId : undefined;

            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [
                    // eslint-disable-next-line no-nested-ternary
                    isDryRun
                        ? 'Push dry run rejected'
                        : (tokenInvalid
                            ? 'Invalid FCM device token — scheduling cleanup'
                            : 'Failed to send push notification'),
                ],
                traceArgs: {
                    'pushNotification.dryRun': isDryRun,
                    'error.message': error?.message,
                    'error.code': fcmErrorCode,
                    'error.stack': error?.stack,
                    'pushNotification.messageData': message && message.data,
                    'pushNotification.messageNotification': message && message.notification,
                    'pushNotification.tokenInvalid': tokenInvalid,
                    'user.id': targetUserId,
                    'pushNotification.lastMomentNotificationDate': metrics?.lastMomentNotificationDate,
                    'pushNotification.lastSpaceNotificationDate': metrics?.lastSpaceNotificationDate,
                    issue: tokenInvalid ? 'invalid fcm device token' : 'failed to send push notification',
                },
            });

            // Never mutate state on a dry run. A dry run is how a post-deploy
            // check exercises this path, and it deliberately uses a bogus token
            // — which `isInvalidTokenError` cannot distinguish from a real
            // user's stale one. Left unguarded, a synthetic check would delete
            // real device registrations and require those users to reopen the
            // app before push worked again.
            if (tokenInvalid && config.deviceToken && !isDryRun) {
                // Fire-and-forget; helper swallows its own errors
                clearInvalidDeviceToken(headers, targetUserId, config.deviceToken);
            }

            // Still never rejects — the fan-out callers below depend on that.
            // The outcome is *reported* instead, so a caller that needs to know
            // (the notification queue worker, via the single-send route) can act
            // on it while the request-path callers keep ignoring it.
            return {
                ok: false,
                errorCode: fcmErrorCode || 'unknown',
                errorMessage: error?.message || String(error),
            };
        });
};

export default admin;

export {
    createMessage,
    predictAndSendNotification,
    describeBrandPushRouting,
    sendMessageForBrandRaw,
};
