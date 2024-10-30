import './wdyr'; // <--- first import, dev only
import React from 'react';
import 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import { PushNotifications } from 'therr-js-utilities/constants';
import App from './main/App';
import { name as appName } from './app.json';
import { sendBackgroundNotification, wrapOnMessageReceived } from './main/utilities/pushNotifications';
import { PressActionIds, getAndroidChannelFromClickActionId } from './main/constants';


// Step 1.) Add PushNotifications.AndroidIntentActions.Therr to the list bellow and the getAndroidChannelFromClickActionId method
// Step 2.) Make sure the server side firebase message is data-only
// Step 3.) Update handleNotifeeNotificationEvent in Layout to handle the press action IDs
// Register background push notification handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
    await wrapOnMessageReceived(false, remoteMessage);

    const { type, timestamp } = remoteMessage.data;

    // Handle data-only notifications which will be converted to Notifee notifications with press actions
    if (
        [
            PushNotifications.AndroidIntentActions.Therr.NEW_GROUP_MESSAGE,
            PushNotifications.AndroidIntentActions.Therr.NUDGE_SPACE_ENGAGEMENT,
        ].includes(remoteMessage?.data?.clickActionId)
    ) {
        const notification = {
            title: remoteMessage?.data?.notificationTitle?.toString() || '',
            body: remoteMessage?.data?.notificationBody?.toString() || '',
            android: {
                pressAction: { id: remoteMessage?.data?.notificationPressActionId, launchActivity: 'default' },
                actions: [
                    {
                        pressAction: { id: PressActionIds.nudge, launchActivity: 'default' },
                        title: remoteMessage?.data?.notificationPressActionCheckIn?.toString() || '',
                    },
                ],
            },
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
