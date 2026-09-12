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
                notification.android.actions.push({
                    pressAction: { id: action.id, launchActivity: 'default' },
                    title: action.title,
                });
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
 * Only `habitCheckin` is handled here. Every other press action navigates, and
 * navigation needs the React tree — those stay in Layout.tsx, which the app
 * launch that follows the press will run.
 */
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { notification, pressAction } = detail || {};

    if (type !== EventType.ACTION_PRESS || pressAction?.id !== PushNotifications.PressActionIds.habitCheckin) {
        return;
    }

    const habitGoalId = notification?.data?.habitGoalId;
    const pactId = notification?.data?.pactId;
    const { didCheckIn, locale } = await completeCheckinInBackground({
        habitGoalId: habitGoalId ? String(habitGoalId) : '',
        pactId: pactId ? String(pactId) : undefined,
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

AppRegistry.registerComponent(appName, () => App);
