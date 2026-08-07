/* eslint-disable no-case-declarations */
import * as admin from 'firebase-admin';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import logSpan from 'therr-js-utilities/log-or-update-span';
import translate from '../utilities/translator';
import { clearInvalidDeviceToken } from '../handlers/helpers/user';
import { getCredentialEnvKey } from './firebaseCredentialEnvKey';

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
    daysRemaining?: number;
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
    return `${head}***@${domain}`;
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
    Object.keys(data).forEach((key) => {
        if (typeof data[key] === 'object') {
            modifiedData[key] = JSON.stringify(data[key]);
        } else {
            modifiedData[key] = data[key];
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

        // HABITS — Streak framing & pact lifecycle.
        // These notifications are HABITS' core retention loop. Loss-aversion
        // copy ("Don't break your N-day streak") and partner-anchored copy
        // ("Sam just hit Day N — don't let them lap you") consistently
        // out-perform generic reminders for habit apps.
        case PushNotifications.Types.streakAtRisk:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.streakAtRisk.title'),
                    notificationBody: translate(config.userLocale, 'notifications.streakAtRisk.body', {
                        streakCount: Number(config.streakCount || 0),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.checkinView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'STREAK_AT_RISK'), brandVariation);
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
        case PushNotifications.Types.partnerCheckedIn:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.partnerCheckedIn.title'),
                    notificationBody: translate(config.userLocale, 'notifications.partnerCheckedIn.body', {
                        partnerName: String(config.partnerName || config.fromUserName || ''),
                        streakCount: Number(config.streakCount || 0),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PARTNER_CHECKED_IN'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.partnerMissedDay:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.partnerMissedDay.title'),
                    notificationBody: translate(config.userLocale, 'notifications.partnerMissedDay.body', {
                        partnerName: String(config.partnerName || config.fromUserName || ''),
                        habitName: String(config.habitName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PARTNER_MISSED_DAY'), brandVariation);
            return baseMessage;
        case PushNotifications.Types.partnerCelebrated:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.partnerCelebrated.title'),
                    notificationBody: translate(config.userLocale, 'notifications.partnerCelebrated.body', {
                        partnerName: String(config.partnerName || config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.pactView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'PARTNER_CELEBRATED'), brandVariation);
            return baseMessage;
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
        case PushNotifications.Types.dailyHabitReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                brandVariation,
                notificationTitle: translate(config.userLocale, 'notifications.dailyHabitReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.dailyHabitReminder.body', {
                    habitName: String(config.habitName || ''),
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'DAILY_HABIT_REMINDER');
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
const predictAndSendNotification = (
    type: PushNotifications.Types,
    data: PushNotifications.INotificationData,
    config: ICreateMessageConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metrics: INotificationMetrics | undefined,
    brandVariation: BrandVariations,
    headers?: InternalConfigHeaders,
) => {
    const message = createMessage(type, data, config, brandVariation);
    // Route sends through the brand's own Firebase project so FCM delivery
    // uses the correct APNS auth key / FCM credentials for this brand.
    const messaging = getAdminAppForBrand(brandVariation).messaging();

    return Promise.resolve()
        .then(() => {
            if (!message) {
                return;
            }

            // Automation
            if (type === PushNotifications.Types.createYourProfileReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.createAMomentReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.completeDraftReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.latestPostLikesStats) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.latestPostViewcountStats) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.unreadNotificationsReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.unclaimedAchievementsReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.inviteFriendsReminder) {
                return messaging.send(message);
            }

            // Event Driven
            if (type === PushNotifications.Types.achievementCompleted) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.leaderboardRankMilestone) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.connectionRequestAccepted) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newConnectionRequest) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newDirectMessage) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newGroupMessage) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newGroupMembers) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newGroupInvite) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newLikeReceived) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newSuperLikeReceived) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newAreasActivated) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.nudgeSpaceEngagement) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.proximityRequiredMoment) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.proximityRequiredSpace) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newThoughtReplyReceived) {
                return messaging.send(message);
            }

            // HABITS — Streak, partner, pact lifecycle, habit reminders
            if (type === PushNotifications.Types.streakAtRisk
                || type === PushNotifications.Types.streakBroken
                || type === PushNotifications.Types.streakMilestone
                || type === PushNotifications.Types.newPersonalRecord
                || type === PushNotifications.Types.partnerCheckedIn
                || type === PushNotifications.Types.partnerMissedDay
                || type === PushNotifications.Types.partnerCelebrated
                || type === PushNotifications.Types.pactInvitation
                || type === PushNotifications.Types.pactNudge
                || type === PushNotifications.Types.pactAccepted
                || type === PushNotifications.Types.pactDeclined
                || type === PushNotifications.Types.pactCompleted
                || type === PushNotifications.Types.pactExpiring
                || type === PushNotifications.Types.dailyHabitReminder
                || type === PushNotifications.Types.morningMotivation
                || type === PushNotifications.Types.eveningCheckIn) {
                return messaging.send(message);
            }

            return null;
        })
        .then(() => {
            if (message) {
                logSpan({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: ['Push successfully sent'],
                    traceArgs: {
                        'pushNotification.message': 'Push successfully sent',
                        'pushNotification.messageData': message.data,
                        'pushNotification.messageNotification': message.notification,
                        'user.id': config.userId,
                        'pushNotification.lastMomentNotificationDate': metrics?.lastMomentNotificationDate,
                        'pushNotification.lastSpaceNotificationDate': metrics?.lastSpaceNotificationDate,
                    },
                });
            }
        })
        .catch((error) => {
            const fcmErrorCode = error?.code || error?.errorInfo?.code;
            const tokenInvalid = isInvalidTokenError(error);
            const targetUserId = typeof config.userId === 'string' ? config.userId : undefined;

            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [
                    tokenInvalid
                        ? 'Invalid FCM device token — scheduling cleanup'
                        : 'Failed to send push notification',
                ],
                traceArgs: {
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

            if (tokenInvalid && config.deviceToken) {
                // Fire-and-forget; helper swallows its own errors
                clearInvalidDeviceToken(headers, targetUserId, config.deviceToken);
            }
        });
};

export default admin;

export {
    createMessage,
    predictAndSendNotification,
    describeBrandPushRouting,
    sendMessageForBrandRaw,
};
