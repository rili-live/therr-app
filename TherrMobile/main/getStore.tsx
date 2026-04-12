import logger from 'redux-logger';
import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistStore, persistReducer } from 'redux-persist';
import basePersistConfig from 'therr-react/redux/persistConfig';
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

const persistConfig = {
    ...basePersistConfig,
    storage: AsyncStorage,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const getMiddleware = (getDefaultMiddleware: any) => {
    const middleware = getDefaultMiddleware({
        serializableCheck: {
            // redux-persist actions contain non-serializable values
            ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
    });

    if (__DEV__) {
        return middleware.concat(socketIOMiddleWare).concat(logger);
    }

    return middleware.concat(socketIOMiddleWare);
};

const getStore = async () => {
    // Migrate existing tokens from AsyncStorage to Keychain (runs once per install)
    await SecureStorage.migrateToSecureStorage();

    // Get stored user details from session storage if they are already logged in
    const therrSession = await AsyncStorage.getItem('therrSession');
    const storedSocketDetails = JSON.parse(therrSession || '{}');
    const therrUser = await SecureStorage.getItem('therrUser');
    const storedUser = JSON.parse(therrUser || '{}');
    const therrUserSettings = await AsyncStorage.getItem('therrUserSettings');
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

    const store = configureStore({
        reducer: persistedReducer,
        preloadedState,
        middleware: getMiddleware,
        devTools: !!__DEV__,
    });

    const persistor = persistStore(store);

    return { store, persistor };
};

export default getStore;
