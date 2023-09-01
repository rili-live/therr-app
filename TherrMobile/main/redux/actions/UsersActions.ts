import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { UsersActions } from 'therr-react/redux/actions';
import getConfig from '../../utilities/getConfig';
import { socketIO } from '../../socket-io-middleware';

// TODO: Use platform to dynamically select googleOAuth2WebClientId
const config = getConfig();

let webClientId = config.googleOAuth2WebClientId;
if (Platform.OS === 'android') {
    webClientId = getConfig().googleOAuth2WebClientIdAndroid;
} else if (Platform.OS === 'ios') {
    webClientId = getConfig().googleOAuth2WebClientIdiOS;
}

GoogleSignin.configure({
    webClientId,
});

export default new UsersActions(socketIO, AsyncStorage, GoogleSignin);
