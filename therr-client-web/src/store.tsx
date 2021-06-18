import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';
import { applyMiddleware, compose, createStore } from 'redux';
import rootReducer from './redux/reducers';
import socketIOMiddleWare, { updateSocketToken } from './socket-io-middleware';

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
        __PRELOADED_STATE__: any;
    }
}

const loggerMiddleware = createLogger();
let preLoadedState;
const composeEnhancers = typeof window === 'object'
    && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ // eslint-disable-line no-underscore-dangle
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({ // eslint-disable-line no-underscore-dangle
        // Specify extension’s options like name, actionsBlacklist, actionsCreators, serialize...
    }) : compose;

// Grab the state from a global variable injected into the server-generated HTML
function safelyParse(input: any) {
    if (input) {
        const doc = new DOMParser().parseFromString(input, 'text/html');
        return JSON.parse(doc.documentElement.textContent || '');
    }
    console.log('Warning: __PRELOADED_STATE__ is not defined on the respective view'); // eslint-disable-line no-console
    return {};
}

// Get stored user details from session storage if they are already logged in
if (typeof (Storage) !== 'undefined' && typeof (window) !== 'undefined') {
    const storedSocketDetails = JSON.parse(localStorage.getItem('therrSession')) || JSON.parse(sessionStorage.getItem('therrSession'));
    let storedUser = JSON.parse(localStorage.getItem('therrUser')) || JSON.parse(sessionStorage.getItem('therrUser'));
    storedUser = storedUser || {};
    const isAuthenticated = !!(storedUser && storedUser.id && storedUser.idToken);
    const reloadedState: any = {
        user: {
            details: storedUser,
            isAuthenticated,
            socketDetails: {
                session: storedSocketDetails || {},
            },
        },
    };
    preLoadedState = Object.assign(safelyParse(window.__PRELOADED_STATE__), reloadedState); // eslint-disable-line no-underscore-dangle
    if (isAuthenticated) {
        updateSocketToken(reloadedState.user, true);
    }
}

const store: any = process.env.NODE_ENV !== 'development'
    ? createStore( // Create Store (Production)
        rootReducer,
        preLoadedState,
        applyMiddleware(
            socketIOMiddleWare,
            thunkMiddleware,
        ),
    )
    : createStore( // Create Store - Redux Development (Chrome Only)
        rootReducer,
        preLoadedState,
        composeEnhancers(
            applyMiddleware(
                loggerMiddleware, // middleware that logs actions (development only)
                socketIOMiddleWare,
                thunkMiddleware, // let's us dispatch functions
            ),
        ),
    );

export default store;
