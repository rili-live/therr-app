import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { UsersActions } from 'therr-react/redux/actions';
import SecureStorage from '../../utilities/SecureStorage';
import getConfig from '../../utilities/getConfig';
import { socketIO } from '../../socket-io-middleware';

// TODO: Use platform to dynamically select googleOAuth2WebClientId
const config = getConfig();

let webClientId = config.googleOAuth2WebClientId;
if (Platform.OS === 'android') {
    webClientId = config.googleOAuth2WebClientIdAndroid;
} else if (Platform.OS === 'ios') {
    webClientId = config.googleOAuth2WebClientIdiOS;
}

console.log('[GoogleSignIn Config] Platform:', Platform.OS);
console.log('[GoogleSignIn Config] webClientId:', webClientId);

GoogleSignin.configure({
    webClientId,
});

export default new UsersActions(socketIO, SecureStorage, GoogleSignin);
