import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';
import { applyMiddleware, compose, createStore } from 'redux';
import rootReducer from './redux/reducers';
// import socketIOMiddleWare, { socketIO, updateSocketToken } from './socket-io-middleware';

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
        __PRELOADED_STATE__: any;
    }
}

const loggerMiddleware = createLogger();
let preLoadedState;
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

// Grab the state from a global variable injected into the server-generated HTML
function safelyParse(input: any) {
    if (input) {
        const doc = new window.DOMParser().parseFromString(input, 'text/html');
        return JSON.parse(doc.documentElement.textContent || '');
    }
    console.log(
        'Warning: __PRELOADED_STATE__ is not defined on the respective view'
    ); // eslint-disable-line no-console
    return {};
}

// Get stored user details from session storage if they are already logged in
if (typeof Storage !== 'undefined' && typeof window !== 'undefined') {
    // const storedSocketDetails = JSON.parse(localStorage.getItem('riliSession')) || JSON.parse(sessionStorage.getItem('riliSession'));
    // let storedUser = JSON.parse(localStorage.getItem('riliUser')) || JSON.parse(sessionStorage.getItem('riliUser'));
    // storedUser = storedUser || {};
    // const reloadedState: any = {
    //     user: {
    //         details: storedUser,
    //         isAuthenticated: !!(storedUser && storedUser.id),
    //         socketDetails: {
    //             session: storedSocketDetails || {},
    //         },
    //     },
    // };
    const reloadedState = {};
    preLoadedState = Object.assign(
        safelyParse(window.__PRELOADED_STATE__),
        reloadedState
    ); // eslint-disable-line no-underscore-dangle
    // updateSocketToken(reloadedState.user, true);
}

const store: any = __DEV__
    ? createStore(
        // Create Store - Redux Development (Chrome Only)
        rootReducer,
        preLoadedState,
        composeEnhancers(
            applyMiddleware(
                loggerMiddleware, // middleware that logs actions (development only)
                // socketIOMiddleWare,
                thunkMiddleware // let's us dispatch functions
            )
        )
    )
    : createStore(
        // Create Store (Production)
        rootReducer,
        preLoadedState,
        compose(
            applyMiddleware(
                // socketIOMiddleWare,
                thunkMiddleware
            )
        )
    );

export default store;
