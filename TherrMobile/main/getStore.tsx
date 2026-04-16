import logger from 'redux-logger';
import { configureStore } from '@reduxjs/toolkit';
import SecureStorage from './utilities/SecureStorage';
import rootReducer from './redux/reducers';
import socketIOMiddleWare, { updateSocketToken } from './socket-io-middleware';

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
        __PRELOADED_STATE__: any;
    }
}

let preloadedState;

const getMiddleware = (getDefaultMiddleware: any) => {
    if (__DEV__) {
        return getDefaultMiddleware().concat(socketIOMiddleWare).concat(logger);
    }

    return getDefaultMiddleware().concat(socketIOMiddleWare);
};

const getStore = async () => {
    // Copy non-secure AsyncStorage data into MMKV (runs once per install).
    // Must run before migrateToSecureStorage so the Keychain-migration flag is
    // forwarded into MMKV.
    await SecureStorage.migrateAsyncStorageToMMKV();
    // Migrate existing tokens from AsyncStorage to Keychain (runs once per install)
    await SecureStorage.migrateToSecureStorage();

    // Get stored user details from session storage if they are already logged in
    const therrSession = await SecureStorage.getItem('therrSession');
    const storedSocketDetails = JSON.parse(therrSession || '{}');
    const therrUser = await SecureStorage.getItem('therrUser');
    let storedUser = JSON.parse(therrUser || '{}');
    const therrUserSettings = await SecureStorage.getItem('therrUserSettings');
    const storedUserSettings = JSON.parse(therrUserSettings || '{}');
    storedUserSettings.locale = storedUserSettings.locale || 'en-us';
    storedUserSettings.mobileThemeName = storedUserSettings.mobileThemeName || 'light';
    storedUserSettings.navigationTourCount = storedUserSettings.navigationTourCount || 0;
    const isAuthenticated = !!(storedUser && storedUser.id && storedUser.idToken);
    const reloadedState: any = {
        user: {
            details: storedUser,
            isAuthenticated,
            settings: storedUserSettings,
            socketDetails: {
                session: storedSocketDetails,
            },
            thoughts: [],
            myThoughts: [],
            myUserGroups: {},
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
        middleware: getMiddleware,
        devTools: !!__DEV__,
    });
};

export default getStore;
