import './wdyr'; // <--- first import, dev only

import React from 'react';
import 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { AppRegistry } from 'react-native';
import App from './main/App';
import { wrapOnMessageReceived } from './main/utilities/pushNotifications';
import { name as appName } from './app.json';

// Register background handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
    await wrapOnMessageReceived(false, remoteMessage);

    const { type, timestamp } = remoteMessage.data;

    if (type === 'test_notifee') {
        notifee.displayNotification({
            title: 'Notifee Test Succeeded',
            body: `Testing background messages succeeded at ${new Date(Number(timestamp)).toString()}!`,
            android: {
                channelId: 'default',
            },
        });
    }
});

AppRegistry.registerComponent(appName, () => App);
