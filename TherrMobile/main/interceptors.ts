import axios from 'axios';
import { CommonActions } from '@react-navigation/native';
import { BrandVariations } from 'therr-js-utilities/constants';
// import { AlertActions } from './library/alerts';
// import { LoaderActions } from './library/loader';
import getConfig from './utilities/getConfig';
import UsersActions from './redux/actions/UsersActions';
import { socketIO } from './socket-io-middleware';

const MAX_LOGOUT_ATTEMPTS = 3;

let timer: any;
let numLoadings = 0;
let logoutAttemptCount = 0;
const _timeout = 350;

const initInterceptors = (
    store,
    baseUrl = getConfig().baseApiGatewayRoute,
    timeout = _timeout
) => {
    // Global axios config
    axios.defaults.baseURL = baseUrl;
    axios.defaults.headers['x-platform'] = 'mobile';
    // NICHE - Set this to app niche
    axios.defaults.headers['x-brand-variation'] = BrandVariations.THERR;

    // Global axios interceptor
    axios.interceptors.request.use((config) => {
        const modifiedConfig = config;
        const storedUser = store.getState().user;
        const token =
            storedUser && storedUser.details && storedUser.details.idToken;
        const userId =
            storedUser && storedUser.details && storedUser.details.id;
        const userSettings = storedUser?.settings || {};

        if (token) {
            modifiedConfig.headers.authorization = `Bearer ${token}`;
            modifiedConfig.headers['x-userid'] = userId;
            modifiedConfig.headers['x-localecode'] = userSettings.locale || 'en-us';
        } else {
            delete modifiedConfig.headers.authorization;
            delete axios.defaults.headers.common.authorization;
        }

        numLoadings += 1;

        if (numLoadings < 2) {
            timer = setTimeout(() => {
                // store.dispatch(LoaderActions.showLoader());
            }, timeout);
        }

        return modifiedConfig;
    });
    axios.interceptors.response.use(
        (response) => {
            logoutAttemptCount = 0;
            if (numLoadings === 0) {
                return response;
            }

            if (numLoadings < 2) {
                clearTimeout(timer);
                // store.dispatch(LoaderActions.hideLoader());
            }
            numLoadings -= 1;

            store.dispatch(
                CommonActions.reset({
                    index: 1,
                    routes: [
                        {
                            name: 'Login',
                        },
                    ],
                })
            );

            return response;
        },
        (error) => {
            if (error.response) {
                if (
                    Number(error.response.status) === 401 ||
                    Number(error.response.data.statusCode) === 401 ||
                    Number(error.response.status) === 403 ||
                    Number(error.response.data.statusCode) === 403
                ) {
                    // store.dispatch(UsersActions.setRedirect(window.location.pathname));
                    // TODO: This is so BAD. Find a better way, but for now it prevents an infinite loop and ensures that the user idToken is reset
                    if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
                        const storedUser = store.getState().user;
                        if (storedUser?.details?.id) {
                            // Close the modal to prevent stuck state
                            store.dispatch(UsersActions.updateTour({
                                isTouring: false,
                                isNavigationTouring: false,
                            }, storedUser?.details?.id));
                        }
                        store.dispatch(UsersActions.logout());
                        logoutAttemptCount += 1;
                    }
                    // store.dispatch(AlertActions.addAlert({
                    //     title: 'Not Authorized',
                    //     message: 'Redirected: You do not have authorization to view this content or your session has expired.
                    // Please login to continue.',
                    //     type: 'error',
                    //     delay: 3000
                    // }));;
                }
            } else if (error) {
                if (
                    Number(error.statusCode) === 401 ||
                    Number(error.statusCode) === 403
                ) {
                    socketIO.disconnect();
                    // store.dispatch(UsersActions.setRedirect(window.location.pathname));
                    // TODO: This is so BAD. Find a better way, but for now it prevents an infinite loop and ensures that the user idToken is reset
                    if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
                        const storedUser = store.getState().user;
                        if (storedUser?.details?.id) {
                            // Close the modal to prevent stuck state
                            store.dispatch(UsersActions.updateTour({
                                isTouring: false,
                                isNavigationTouring: false,
                            }, storedUser?.details?.id));
                        }
                        store.dispatch(UsersActions.logout());
                        logoutAttemptCount += 1;
                    }
                    // store.dispatch(AlertActions.addAlert({
                    //     title: 'Not Authorized',
                    //     message: 'Redirected: You do not have authorization to view this content or your session has expired.
                    // Please login to continue.',
                    //     type: 'error',
                    //     delay: 3000
                    // }));;
                }
            }

            if (numLoadings === 0) {
                return Promise.reject(
                    error && error.response && error.response.data
                );
            }

            if (numLoadings < 2) {
                clearTimeout(timer);
                // store.dispatch(LoaderActions.hideLoader());
            }
            numLoadings -= 1;

            return Promise.reject(
                (error && error.response && error.response.data) ||
                    (error && error.response) ||
                    error
            );
        }
    );
};

export default initInterceptors;
