import axios from 'axios';
// import { AlertActions } from './library/alerts';
// import { LoaderActions } from './library/loader';
import store from './store';
import * as globalConfig from '../../global-config';
import UsersActions from './redux/actions/UsersActions';

let timer: any;
let numLoadings = 0;
const _timeout = 350; // eslint-disable-line no-underscore-dangle

const initInterceptors = (
    history: any,
    baseUrl = globalConfig[process.env.NODE_ENV].baseApiGatewayRoute,
    timeout = _timeout,
) => {
    // Global axios config
    axios.defaults.baseURL = baseUrl;
    axios.defaults.headers['x-platform'] = 'desktop';

    // Global axios interceptor
    axios.interceptors.request.use((config) => {
        const modifiedConfig = config;
        const storedUser = store.getState().user;
        const token = storedUser && storedUser.details && storedUser.details.idToken;
        const userId = storedUser && storedUser.details && storedUser.details.id;

        if (token) {
            modifiedConfig.headers.authorization = `Bearer ${token}`;
            modifiedConfig.headers['x-userid'] = userId;
            // TODO: Also set user locale
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
                // store.dispatch(UsersActions.setRedirect(window.location.pathname));
                store.dispatch(UsersActions.logout());
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
                    history.replace('/login');
                }
            }
        } else if (error) {
            if (
                Number(error.statusCode) === 401
                || Number(error.statusCode) === 403
            ) {
                // store.dispatch(UsersActions.setRedirect(window.location.pathname));
                store.dispatch(UsersActions.logout());
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
                    history.replace('/login');
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
