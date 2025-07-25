import './wdyr'; // <--- first import, dev only
import React from 'react';
import 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import { PushNotifications } from 'therr-js-utilities/constants';
import App from './main/App';
import { name as appName } from './app.json';
import { sendBackgroundNotification, wrapOnMessageReceived } from './main/utilities/pushNotifications';
import { getAndroidChannelFromClickActionId } from './main/constants';


// Step 1.) Add PushNotifications.AndroidIntentActions.Teem to the list bellow and the getAndroidChannelFromClickActionId method
// Step 2.) Make sure the server side firebase message is data-only
// Step 3.) Remove navigation logic for clickId in Layout.tsx
// Step 4.) Update handleNotifeeNotificationEvent in Layout to handle the press action IDs
/** Register background push notification handler */
messaging().setBackgroundMessageHandler(async remoteMessage => {
    await wrapOnMessageReceived(false, remoteMessage);

    // Handle data-only notifications which will be converted to Notifee notifications with press actions
    if (
        [
            PushNotifications.AndroidIntentActions.Teem.LATEST_POST_VIEWCOUNT_STATS,
            PushNotifications.AndroidIntentActions.Teem.NEW_CONNECTION_REQUEST,
            PushNotifications.AndroidIntentActions.Teem.NEW_CONNECTION,
            PushNotifications.AndroidIntentActions.Teem.NEW_DIRECT_MESSAGE,
            PushNotifications.AndroidIntentActions.Teem.NEW_GROUP_MESSAGE,
            PushNotifications.AndroidIntentActions.Teem.NEW_LIKE_RECEIVED,
            PushNotifications.AndroidIntentActions.Teem.NEW_SUPER_LIKE_RECEIVED,
            PushNotifications.AndroidIntentActions.Teem.NEW_THOUGHT_REPLY_RECEIVED,
            PushNotifications.AndroidIntentActions.Teem.NUDGE_SPACE_ENGAGEMENT,
        ].includes(remoteMessage?.data?.clickActionId)
    ) {
        const notification = {
            title: remoteMessage?.data?.notificationTitle?.toString() || '',
            body: remoteMessage?.data?.notificationBody?.toString() || '',
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
            getAndroidChannelFromClickActionId(remoteMessage?.data?.clickActionId),
        )
            .catch((err) => console.log(err));
    }

    return Promise.resolve();
});

AppRegistry.registerComponent(appName, () => App);
