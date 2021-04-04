/**
 * @format
 */
import messaging from '@react-native-firebase/messaging';

// Register background handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Message handled in the background!', remoteMessage);
});

import { AppRegistry } from 'react-native';
import App from './main/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
