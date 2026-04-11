import LogRocket from 'logrocket';
import logger from 'redux-logger';
import { configureStore, Middleware } from '@reduxjs/toolkit';
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
const safeParse = (key: string, storage: Storage) => {
    try {
        return JSON.parse(storage.getItem(key) as string);
    } catch (e) {
        storage.removeItem(key);
        return null;
    }
};
if (typeof (Storage) !== 'undefined' && typeof (window) !== 'undefined') {
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
    if (process.env.NODE_ENV === 'development') {
        return getDefaultMiddleware().concat(socketIOMiddleWare).concat(LogRocket.reduxMiddleware()).concat(logger as Middleware);
    }

    return getDefaultMiddleware().concat(socketIOMiddleWare).concat(LogRocket.reduxMiddleware());
};

const store: any = configureStore( // Create Store (Production)
    {
        reducer: rootReducer,
        preloadedState,
        middleware: getMiddleware,
        devTools: process.env.NODE_ENV === 'development',
    },
);

export default store;
