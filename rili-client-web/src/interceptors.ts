import axios from 'axios';
// import { AlertActions } from './library/alerts';
// import { LoaderActions } from './library/loader';
// import { UserActions } from './library/authentication';
import store from './store';
import * as globalConfig from '../../global-config.js';

let timer: NodeJS.Timeout;
let numLoadings = 0;
const _timeout = 350; // eslint-disable-line no-underscore-dangle

const initInterceptors = (
    history: any,
    baseUrl = globalConfig[process.env.NODE_ENV].baseApiRoute,
    timeout = _timeout,
) => {
    // Global axios config
    axios.defaults.baseURL = baseUrl;

    // Global axios interceptor
    axios.interceptors.request.use((config) => {
        const modifiedConfig = config;
        const token = store.getState().user && store.getState().user.idToken;

        if (token) {
            modifiedConfig.headers.authorization = `Bearer ${token}`;
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
                // store.dispatch(UserActions.setRedirect(window.location.pathname));
                // store.dispatch(UserActions.logout());
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
                    history.push('/login');
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
