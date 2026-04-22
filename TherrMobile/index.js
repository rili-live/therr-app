// import './wdyr'; // <--- disabled: not compatible with React 19
import React from 'react';
import 'react-native-gesture-handler';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './main/App';
import { name as appName } from './app.json';
import configurePromiseRejections from './main/utilities/configurePromiseRejections';
import { sendBackgroundNotification, wrapOnMessageReceived } from './main/utilities/pushNotifications';
import { getAndroidChannelFromClickActionId } from './main/constants';

configurePromiseRejections();


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

AppRegistry.registerComponent(appName, () => App);
