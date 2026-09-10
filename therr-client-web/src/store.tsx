import logger from 'redux-logger';
import { configureStore, Middleware } from '@reduxjs/toolkit';
import {
    persistStore,
    persistReducer,
    Persistor,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // localStorage
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
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

// Late-bound reference to the persistor created below. The purge middleware needs it,
// but it can only exist after the store is configured.
let persistorRef: Persistor | null = null;

// redux-persist keeps its own copy of the whitelisted slices (`user`, `content`,
// `notifications`, `userConnections`) in localStorage. On logout the reducers clear
// those slices, but nothing purges the persisted copy — and REHYDRATE merges it back
// over `preloadedState` on the next load. The next account to sign in on this browser
// therefore inherits the previous account's cached data: their connections list, their
// notifications, their feed. Purge here so a session's data can never outlive it.
// Mirrors `purgeOnLogoutMiddleware` in TherrMobile/main/getStore.tsx.
//
// Reads through `persistorRef` rather than the `persistor` const below: the innermost
// body cannot run before module evaluation finishes, so referencing `persistor` directly
// would be correct at runtime, but `no-use-before-define` cannot see that and would
// need two disable comments to say so.
const purgeOnLogoutMiddleware = () => (next: any) => (action: any) => {
    const result = next(action);

    if (action?.type === SocketClientActionTypes.LOGOUT && persistorRef) {
        persistorRef.purge().catch((err: any) => {
            console.log('Failed to purge persisted state on logout:', err); // eslint-disable-line no-console
        });
    }

    return result;
};

const getMiddleware = (getDefaultMiddleware: any) => {
    const middleware = getDefaultMiddleware({
        serializableCheck: {
            // redux-persist actions carry non-serializable callbacks (e.g. the
            // `result` fn on PURGE/REGISTER). Ignore the full set of persist actions.
            ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
    }).concat(purgeOnLogoutMiddleware);

    if (process.env.NODE_ENV === 'development') {
        return middleware.concat(socketIOMiddleWare).concat(logger as Middleware);
    }

    return middleware.concat(socketIOMiddleWare);
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
persistorRef = persistor;

export { persistor };
export default store;
