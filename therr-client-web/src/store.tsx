import LogRocket from 'logrocket';
import logger from 'redux-logger';
import { configureStore, Middleware } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // localStorage
import basePersistConfig from 'therr-react/redux/persistConfig';
import rootReducer from './redux/reducers';
import socketIOMiddleWare, { updateSocketToken } from './socket-io-middleware';

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
        __PRELOADED_STATE__: any;
    }
}

let preloadedState;

// Grab the state from a global variable injected into the server-generated HTML
function safelyParse(input: any) {
    if (input && typeof input === 'object') {
        return input;
    }
    if (input && typeof input === 'string') {
        try {
            return JSON.parse(input);
        } catch (e) {
            return {};
        }
    }
    console.log('Warning: __PRELOADED_STATE__ is not defined on the respective view'); // eslint-disable-line no-console
    return {};
}

// Get stored user details from session storage if they are already logged in
const safeParse = (key: string, storageObj: Storage) => {
    try {
        return JSON.parse(storageObj.getItem(key) as string);
    } catch (e) {
        storageObj.removeItem(key);
        return null;
    }
};

// Only apply persistence on the client (not during SSR)
const isClient = typeof window !== 'undefined' && typeof Storage !== 'undefined';

const persistConfig = {
    ...basePersistConfig,
    storage,
};

const persistedReducer = isClient
    ? persistReducer(persistConfig, rootReducer)
    : rootReducer;

if (isClient) {
    const storedSocketDetails = safeParse('therrSession', localStorage) || safeParse('therrSession', sessionStorage);
    let storedUser = safeParse('therrUser', localStorage) || safeParse('therrUser', sessionStorage);
    storedUser = storedUser || {};
    const isAuthenticated = !!(storedUser && storedUser.id && storedUser.idToken);
    // URL prefix is the source of truth for page locale
    const localeUrlMatch = window.location.pathname.match(/^\/(es|fr)(\/|$)/);
    let localeFromUrl = 'en-us';
    if (localeUrlMatch) {
        localeFromUrl = localeUrlMatch[1] === 'fr' ? 'fr-ca' : localeUrlMatch[1];
    }
    const reloadedState: any = {
        user: {
            details: storedUser,
            isAuthenticated,
            settings: {
                locale: localeFromUrl,
                mobileThemeName: 'retro',
            },
            socketDetails: {
                session: storedSocketDetails || {},
            },
        },
    };
    preloadedState = Object.assign(safelyParse(window.__PRELOADED_STATE__), reloadedState); // eslint-disable-line no-underscore-dangle
    if (isAuthenticated) {
        updateSocketToken(reloadedState.user, true);
    }
}

const getMiddleware = (getDefaultMiddleware: any) => {
    const middleware = getDefaultMiddleware({
        serializableCheck: {
            // redux-persist actions contain non-serializable values
            ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
    });

    if (process.env.NODE_ENV === 'development') {
        return middleware.concat(socketIOMiddleWare).concat(LogRocket.reduxMiddleware()).concat(logger as Middleware);
    }

    return middleware.concat(socketIOMiddleWare).concat(LogRocket.reduxMiddleware());
};

const store: any = configureStore(
    {
        reducer: persistedReducer as any,
        preloadedState,
        middleware: getMiddleware,
        devTools: process.env.NODE_ENV === 'development',
    },
);

// Only create persistor on client side
const persistor = isClient ? persistStore(store) : null;

export { persistor };
export default store;
