import axios from 'axios';
// import { AlertActions } from './library/alerts';
// import { LoaderActions } from './library/loader';
import { BrandVariations } from 'therr-js-utilities/constants';
import { NavigateFunction } from 'react-router-dom';
import store from './store';
import * as globalConfig from '../../global-config';
import UsersActions from './redux/actions/UsersActions';

const MAX_LOGOUT_ATTEMPTS = 3;

let timer: any;
let numLoadings = 0;
let logoutAttemptCount = 0;
const _timeout = 350; // eslint-disable-line no-underscore-dangle

const initInterceptors = (
    navigate: NavigateFunction,
    baseUrl = globalConfig[process.env.NODE_ENV].baseApiGatewayRoute,
    timeout = _timeout,
) => {
    // Global axios config
    axios.defaults.baseURL = baseUrl;
    axios.defaults.headers['x-platform'] = 'desktop';
    axios.defaults.headers['x-brand-variation'] = BrandVariations.THERR;

    // Global axios interceptor
    axios.interceptors.request.use((config) => {
        const modifiedConfig: any = config;
        const storedUser = store.getState().user;
        const token = storedUser && storedUser.details && storedUser.details.idToken;
        const userId = storedUser && storedUser.details && storedUser.details.id;

        if (token) {
            modifiedConfig.headers.authorization = `Bearer ${token}`;
            modifiedConfig.headers['x-userid'] = userId;
            // TODO: Also set user locale
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
    axios.interceptors.response.use((response) => {
        logoutAttemptCount = 0;
        if (numLoadings === 0) { return response; }

        if (numLoadings < 2) {
            clearTimeout(timer);
            // store.dispatch(LoaderActions.hideLoader());
        }
        numLoadings -= 1;

        return response;
    }, (error) => {
        if (error.response) {
            if (Number(error.response.status) === 401 || Number(error.response.data.statusCode) === 401) {
                // store.dispatch(UsersActions.setRedirect(window.location.pathname));
                if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
                    store.dispatch(UsersActions.logout());
                    logoutAttemptCount += 1;
                }
                // store.dispatch(AlertActions.addAlert({
                //     title: 'Not Authorized',
                //     message: 'Redirected: You do not have authorization to view this content or your session has expired.
                // Please login to continue.',
                //     type: 'error',
                //     delay: 3000
                // }));

                // Do not redirect when 401 occurs on a login page
                // The "home" page is also a login
                if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
                    navigate('/login');
                }
            }
        } else if (error) {
            if (
                Number(error.statusCode) === 401
                || Number(error.statusCode) === 403
            ) {
                // store.dispatch(UsersActions.setRedirect(window.location.pathname));
                if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
                    store.dispatch(UsersActions.logout());
                    logoutAttemptCount += 1;
                }
                // store.dispatch(AlertActions.addAlert({
                //     title: 'Not Authorized',
                //     message: 'Redirected: You do not have authorization to view this content or your session has expired.
                // Please login to continue.',
                //     type: 'error',
                //     delay: 3000
                // }));

                // Do not redirect when 401 occurs on a login page
                // The "home" page is also a login
                if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
                    navigate('/login');
                }
            }
        }

        if (numLoadings === 0) {
            return Promise.reject(error && error.response && error.response.data);
        }

        if (numLoadings < 2) {
            clearTimeout(timer);
            // store.dispatch(LoaderActions.hideLoader());
        }
        numLoadings -= 1;

        return Promise.reject(error.response.data);
    });
};

export default initInterceptors;
