import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';
import { applyMiddleware, compose, createStore } from 'redux';
import rootReducer from './redux/reducers';
import socketIOMiddleWare from './socket-io-middleware';

declare global {
    interface Window { // tslint:disable-line interface-name
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
        __PRELOADED_STATE__: any;
    }
}

const loggerMiddleware = createLogger();
let store: any, preLoadedState;
// let storedUser: any;

const composeEnhancers = typeof window === 'object' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ?
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        // Specify extension’s options like name, actionsBlacklist, actionsCreators, serialize...
    }) : compose;

// Grab the state from a global variable injected into the server-generated HTML
function safelyParse(input: any) {
    if (input) {
        var doc = new DOMParser().parseFromString(input, 'text/html');
        return JSON.parse(doc.documentElement.textContent);
    } else {
        console.log('Warning: __PRELOADED_STATE__ is not defined on the respective view'); // tslint:disable-line no-console
        return {};
    }
}

// Get stored user details from session storage if they are already logged in
if (typeof(Storage) !== 'undefined' && typeof(window) !== 'undefined') {
    // storedUser = JSON.parse(sessionStorage.getItem('user'));
    // storedUser = storedUser ? storedUser : {};
    // preLoadedState = Object.assign(safelyParse(window.__PRELOADED_STATE__), {'user': storedUser, 'isAuthenticated': !!storedUser.roleConfig});
    preLoadedState = safelyParse(window.__PRELOADED_STATE__);
}

if (process.env.NODE_ENV === 'production') {
    // Create Store (Production)
    store = createStore(
        rootReducer,
        preLoadedState,
        applyMiddleware(
            socketIOMiddleWare,
            thunkMiddleware
        )
    );
} else {
    // Create Store - Redux Development (Chrome Only)
    store = createStore(
        rootReducer,
        preLoadedState,
        composeEnhancers(applyMiddleware(
            loggerMiddleware, // middleware that logs actions (development only)
            socketIOMiddleWare,
            thunkMiddleware, // let's us dispatch functions
        ))
    );
}

export default store;