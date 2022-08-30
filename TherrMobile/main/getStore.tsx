
import logger from 'redux-logger';
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './redux/reducers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketIOMiddleWare, { updateSocketToken } from './socket-io-middleware';

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
        __PRELOADED_STATE__: any;
    }
}

let preloadedState;

const getStore = async () => {
    // Get stored user details from session storage if they are already logged in
    const therrSession = await AsyncStorage.getItem('therrSession');
    const storedSocketDetails = JSON.parse(therrSession || '{}');
    const therrUser = await AsyncStorage.getItem('therrUser');
    let storedUser = JSON.parse(therrUser || '{}');
    const therrUserSettings = await AsyncStorage.getItem('therrUserSettings');
    const storedUserSettings = JSON.parse(therrUserSettings || '{}');
    storedUserSettings.locale = storedUserSettings.locale || 'en-us';
    storedUserSettings.mobileThemeName = storedUserSettings.mobileThemeName || 'light';
    const isAuthenticated = !!(storedUser && storedUser.id && storedUser.idToken);
    const reloadedState: any = {
        user: {
            details: storedUser,
            isAuthenticated,
            settings: storedUserSettings,
            socketDetails: {
                session: storedSocketDetails,
            },
        },
    };
    if (isAuthenticated) {
        updateSocketToken(reloadedState.user, true);
    }

    preloadedState = { ...reloadedState };

    return configureStore({
        // Create Store - Redux Development (Chrome Only)
        reducer: rootReducer,
        preloadedState,
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(socketIOMiddleWare).concat(logger),
        devTools: !!__DEV__,
    });
};

export default getStore;
