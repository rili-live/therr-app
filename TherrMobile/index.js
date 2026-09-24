// import './wdyr'; // <--- disabled: not compatible with React 19
import React from 'react';
import 'react-native-gesture-handler';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './main/App';
import { name as appName } from './app.json';
import configurePromiseRejections from './main/utilities/configurePromiseRejections';
import notifee, { EventType } from '@notifee/react-native';
import { PushNotifications } from 'therr-js-utilities/constants';
import { createAndroidNotificationChannels, sendBackgroundNotification, wrapOnMessageReceived } from './main/utilities/pushNotifications';
import { getAndroidChannelFromClickActionId } from './main/constants';
import completeCheckinInBackground from './main/utilities/backgroundCheckin';
import refreshHabitsWidgetInBackground, { shouldRefreshWidgetForPush } from './main/utilities/habitsWidgetRefresh';
import { WIDGET_REFRESH_TASK_KEY } from './main/utilities/habitsWidget';
import translate from './main/utilities/translator';

configurePromiseRejections();

// Register the Android notification channels before anything can post to one.
// Display notifications (push-notifications-service createNotificationMessage)
// are rendered by the OS and name a channelId we never see in JS, so the channel
// has to already exist or the notification lands on the FCM SDK's fallback
// "Miscellaneous" channel at DEFAULT importance. Fire-and-forget: it resolves
// long before a push can arrive, and createAndroidNotificationChannels swallows
// its own errors. Runs here rather than in App.tsx so the background/headless
// entry point is covered too.
createAndroidNotificationChannels();


/** Register background push notification handler */
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
    await wrapOnMessageReceived(false, remoteMessage);

    // A habits push means the board or today's count has plausibly moved, and this handler is
    // already a headless task with the process awake — so the home-screen widget refreshes
    // now rather than on its next tick. No-ops without a placed widget, and never fails the
    // notification below: the widget is decoration, the notification is the point.
    if (shouldRefreshWidgetForPush(remoteMessage?.data?.type)) {
        await refreshHabitsWidgetInBackground({ reason: 'push' }).catch(() => undefined);
    }

    // Data-only FCM messages sent via push-notifications-service
    // createDataOnlyMessage() always include `clickActionId`,
    // `notificationTitle`, and `notificationBody` in their data payload, and
    // need to be rendered locally via Notifee (iOS silent push + Android
    // background wake-up). Display-style messages (createNotificationMessage)
    // render natively via the OS and never reach this handler with those
    // fields populated. Matching on shape instead of an allowlist means any
    // new notification type added on the backend works without editing this
    // file, and it's brand-agnostic (works on Therr, Teem, Habits, etc.).
    const clickActionId = remoteMessage?.data?.clickActionId;
    const notificationTitle = remoteMessage?.data?.notificationTitle?.toString() || '';
    const notificationBody = remoteMessage?.data?.notificationBody?.toString() || '';

    if (clickActionId && (notificationTitle || notificationBody)) {
        const notification = {
            title: notificationTitle,
            body: notificationBody,
            android: {},
            data: remoteMessage?.data,
        };

        if (remoteMessage?.data?.notificationPressActionId) {
            notification.android.pressAction = { id: remoteMessage?.data?.notificationPressActionId, launchActivity: 'default' };
        }

        if (remoteMessage?.data?.notificationLinkPressActions) {
            const actions = JSON.parse(remoteMessage?.data?.notificationLinkPressActions);
            notification.android.actions = [];
            actions.forEach((action) => {
                const androidAction = {
                    pressAction: { id: action.id, launchActivity: 'default' },
                    title: action.title,
                };

                // The savings check-in is the one action that collects a value rather
                // than just firing. `input: true` turns the button into an Android
                // RemoteInput field, and whatever is typed arrives as `detail.input` on
                // the background event below.
                //
                // `launchActivity: 'default'` above is deliberately kept: if the OS or
                // the launcher cannot render an inline input (Android Auto, some
                // launchers, Wear), the button falls back to opening the app rather
                // than silently doing nothing.
                if (action.id === PushNotifications.PressActionIds.habitCheckinSavings) {
                    androidAction.input = {
                        allowFreeFormInput: true,
                        placeholder: remoteMessage?.data?.currencyCode
                            ? String(remoteMessage.data.currencyCode)
                            : undefined,
                    };
                }

                notification.android.actions.push(androidAction);
            });
        }

        return sendBackgroundNotification(
            notification,
            getAndroidChannelFromClickActionId(clickActionId),
        )
            .catch((err) => console.log(err));
    }

    return Promise.resolve();
});

/**
 * Notifee background events — the one-press check-in.
 *
 * Registered HERE rather than in Layout.tsx on purpose. Notifee requires its
 * background event handler at module top level: the handler in Layout.tsx is
 * inside the React tree, so it only exists while the app process is alive, and
 * an action pressed on a killed app reaches nothing (a body tap is recovered
 * later by getInitialNotification; an action press is not — the app opens on
 * whatever screen it left, and the check-in never happens).
 *
 * Only the two check-in actions are handled here — `habitCheckin` (a plain
 * button) and `habitCheckinSavings` (the same thing carrying a typed amount).
 * Every other press action navigates, and navigation needs the React tree —
 * those stay in Layout.tsx, which the app launch that follows the press will run.
 */
const BACKGROUND_CHECKIN_ACTION_IDS = [
    PushNotifications.PressActionIds.habitCheckin,
    PushNotifications.PressActionIds.habitCheckinSavings,
];

notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { notification, pressAction, input } = detail || {};

    if (type !== EventType.ACTION_PRESS || !BACKGROUND_CHECKIN_ACTION_IDS.includes(pressAction?.id)) {
        return;
    }

    const habitGoalId = notification?.data?.habitGoalId;
    const pactId = notification?.data?.pactId;
    // `detail.input` is only populated for an action declared with `input`, so it is
    // undefined for the plain check-in — which is exactly the "no amount recorded"
    // case the service already handles.
    const { didCheckIn, locale } = await completeCheckinInBackground({
        habitGoalId: habitGoalId ? String(habitGoalId) : '',
        pactId: pactId ? String(pactId) : undefined,
        savedAmount: typeof input === 'string' ? input : undefined,
    });

    if (notification?.id) {
        await notifee.cancelNotification(notification.id).catch(() => undefined);
    }

    // Always replace the notification the press dismissed, success or not.
    // Saying nothing on failure would read as "it worked" — and the usual cause
    // is an expired session, which only the app can resolve, so the failure
    // notification opens the habit for the user to finish there.
    const copyKey = didCheckIn ? 'checkinSucceeded' : 'checkinFailed';

    return sendBackgroundNotification(
        {
            title: translate(locale, `alertTitles.${copyKey}`),
            body: translate(locale, `alertMessages.${copyKey}`),
            android: {
                pressAction: { id: PushNotifications.PressActionIds.checkinView, launchActivity: 'default' },
            },
            data: notification?.data,
        },
        getAndroidChannelFromClickActionId(notification?.data?.clickActionId),
    ).catch((err) => console.log(err));
});

/**
 * Home-screen widget background refresh.
 *
 * Started by android/.../widget/HabitsWidgetRefreshWorker.kt when the widget asks for fresh
 * data (its periodic tick, first placement, a tap on its "updated N ago" label). Like the
 * Notifee handler above it runs without the React tree, so it reads the stored session itself.
 * Must be registered at module top level — a task started against a cold process reaches
 * nothing registered later.
 */
AppRegistry.registerHeadlessTask(WIDGET_REFRESH_TASK_KEY, () => (data) => (
    refreshHabitsWidgetInBackground({ reason: data?.reason }).then(() => undefined)
));

AppRegistry.registerComponent(appName, () => App);
