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
    if (input) {
        const doc = new DOMParser().parseFromString(input, 'text/html');
        return JSON.parse(doc.documentElement?.textContent?.replace(/\\u0085/g, '\n').replace(/\\u000D/g, '\r') || '{}');
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
    const storedSettings = safeParse('therrUserSettings', localStorage)
        || safeParse('therrUserSettings', sessionStorage);
    storedUser = storedUser || {};
    const isAuthenticated = !!(storedUser && storedUser.id && storedUser.idToken);
    const reloadedState: any = {
        user: {
            details: storedUser,
            isAuthenticated,
            settings: {
                locale: storedSettings?.settingsLocale || storedSettings?.locale || 'en-us',
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
