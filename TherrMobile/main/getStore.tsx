
import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';
import { applyMiddleware, compose, createStore } from 'redux';
import rootReducer from './redux/reducers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketIOMiddleWare, { updateSocketToken } from './socket-io-middleware';

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
        __PRELOADED_STATE__: any;
    }
}

const loggerMiddleware = createLogger();
let preLoadedState;
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const getStore = async () => {
    // Get stored user details from session storage if they are already logged in
    const therrSession = await AsyncStorage.getItem('therrSession');
    const storedSocketDetails = JSON.parse(therrSession || '{}');
    const therrUser = await AsyncStorage.getItem('therrUser');
    let storedUser = JSON.parse(therrUser || '{}');
    const therrUserSettings = await AsyncStorage.getItem('therrUserSettings');
    const storedUserSettings = JSON.parse(therrUserSettings || '{}');
    storedUserSettings.locale = storedUserSettings.locale || 'en-us';
    storedUserSettings.mobileThemeName = storedUserSettings.mobileThemeName || 'retro';
    const isAuthenticated = !!(storedUser && storedUser.id && storedUser.idToken);
    const reloadedState: any = {
        user: {
            details: storedUser,
            isAuthenticated,
            settings: storedUserSettings,
            socketDetails: {
                session: storedSocketDetails,
            },
        },
    };
    if (isAuthenticated) {
        updateSocketToken(reloadedState.user, true);
    }

    preLoadedState = { ...reloadedState };

    return __DEV__
        ? createStore(
            // Create Store - Redux Development (Chrome Only)
            rootReducer,
            preLoadedState,
            composeEnhancers(
                applyMiddleware(
                    loggerMiddleware, // middleware that logs actions (development only)
                    socketIOMiddleWare,
                    thunkMiddleware // let's us dispatch functions
                )
            )
        )
        : createStore(
            // Create Store (Production)
            rootReducer,
            preLoadedState,
            compose(applyMiddleware(socketIOMiddleWare, thunkMiddleware))
        );
};

export default getStore;
