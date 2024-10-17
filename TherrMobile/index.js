import './wdyr'; // <--- first import, dev only

import React from 'react';
import 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { AppRegistry } from 'react-native';
import App from './main/App';
import { name as appName } from './app.json';
import { sendBackgroundNotification, wrapOnMessageReceived } from './main/utilities/pushNotifications';
import { AndroidChannelIds, PressActionIds, getAndroidChannel } from './main/constants';

// Register background push notification handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
    await wrapOnMessageReceived(false, remoteMessage);

    const { type, timestamp } = remoteMessage.data;

    // Handle the data-only notification
    if (remoteMessage?.data?.clickActionId === 'app.therrmobile.NUDGE_SPACE_ENGAGEMENT') {
        // TODO: Include translations from server push notification data
        return sendBackgroundNotification({
            title: remoteMessage?.data?.notificationTitle?.toString() || '',
            body: remoteMessage?.data?.notificationBody?.toString() || '',
            android: {
                pressAction: { id: PressActionIds.nudge, launchActivity: 'default' },
                actions: [
                    {
                        pressAction: { id: PressActionIds.nudge, launchActivity: 'default' },
                        title: remoteMessage?.data?.notificationPressActionCheckIn?.toString() || '',
                    },
                ],
            },
            data: remoteMessage?.data,
        }, getAndroidChannel(AndroidChannelIds.rewardUpdates, false))
            .catch((err) => console.log(err));
    }

    return Promise.resolve();
});

AppRegistry.registerComponent(appName, () => App);
