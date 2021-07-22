import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { UsersActions } from 'therr-react/redux/actions';
import getConfig from '../../utilities/getConfig';
import { socketIO } from '../../socket-io-middleware';

GoogleSignin.configure({
    webClientId: getConfig().googleOAuth2WebClientId,
});

export default new UsersActions(socketIO, AsyncStorage, GoogleSignin);
