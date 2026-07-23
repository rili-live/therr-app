import logger from 'redux-logger';
import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistStore, persistReducer } from 'redux-persist';
import type { Persistor } from 'redux-persist';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import basePersistConfig from 'therr-react/redux/persistConfig';
import SecureStorage from './utilities/SecureStorage';
import rootReducer from './redux/reducers';
import socketIOMiddleWare, { updateSocketToken } from './socket-io-middleware';

// Redux-logger serializes the full prev/next state on every dispatch, which
// stalls the JS thread during action bursts (route transitions + REST responses).
// Keep it off by default; flip to true only when actively debugging dispatches.
const ENABLE_REDUX_LOGGER = false;

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
        __PRELOADED_STATE__: any;
    }
}

let preloadedState;

// redux-persist still uses AsyncStorage as the storage engine. Migrating it to
// MMKV is a follow-up PR — it requires a dedicated MMKV storage adapter and
// rehydration of existing persisted state.
const persistConfig = {
    ...basePersistConfig,
    storage: AsyncStorage,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Late-bound reference to the persistor created in `getStore`. The purge
// middleware needs it, but it can only exist after the store is configured.
let persistor: Persistor | null = null;

// redux-persist keeps its own copy of the whitelisted slices (`user`,
// `content`, `notifications`, `userConnections`) in AsyncStorage, separate
// from the SecureStorage/Keychain copy that `getStore` rehydrates into
// `preloadedState`. On logout the shared action clears SecureStorage and
// dispatches LOGOUT, but nothing purges redux-persist. Because REHYDRATE
// merges the persisted `user` slice back over `preloadedState` on the next
// cold start, a stale *authenticated* snapshot silently re-authenticates the
// user. Purge the persisted copy here so it can never outlive the session.
// Covers every logout dispatcher (header menu, Settings, interceptor 401
// tear-down) from a single point.
const purgeOnLogoutMiddleware = () => (next: any) => (action: any) => {
    const result = next(action);

    if (action?.type === SocketClientActionTypes.LOGOUT && persistor) {
        persistor.purge().catch((err) => {
            console.log('Failed to purge persisted state on logout:', err);
        });
    }

    return result;
};

const getMiddleware = (getDefaultMiddleware: any) => {
    const middleware = getDefaultMiddleware({
        serializableCheck: {
            // redux-persist actions contain non-serializable values
            ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
    }).concat(purgeOnLogoutMiddleware);

    if (__DEV__ && ENABLE_REDUX_LOGGER) {
        return middleware.concat(socketIOMiddleWare).concat(logger);
    }

    return middleware.concat(socketIOMiddleWare);
};

const getStore = async () => {
    // Copy non-secure AsyncStorage data into MMKV (runs once per install).
    await SecureStorage.migrateAsyncStorageToMMKV();
    // Migrate existing tokens from AsyncStorage to Keychain (runs once per install)
    await SecureStorage.migrateToSecureStorage();

    // Get stored user details from session storage if they are already logged in
    const therrSession = await SecureStorage.getItem('therrSession');
    const storedSocketDetails = JSON.parse(therrSession || '{}');
    const therrUser = await SecureStorage.getItem('therrUser');
    const storedUser = JSON.parse(therrUser || '{}');
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

    const store = configureStore({
        reducer: persistedReducer,
        preloadedState,
        middleware: getMiddleware,
        devTools: !!__DEV__,
    });

    persistor = persistStore(store);

    return { store, persistor };
};

export default getStore;
