import axios from 'axios';
// import { AlertActions } from './library/alerts';
// import { LoaderActions } from './library/loader';
import { BrandVariations } from 'therr-js-utilities/constants';
import { NavigateFunction } from 'react-router-dom';
import { UsersService } from 'therr-react/services';
import store from './store';
import * as globalConfig from '../../global-config';
import UsersActions from './redux/actions/UsersActions';

const MAX_LOGOUT_ATTEMPTS = 3;

let timer: any;
let numLoadings = 0;
let logoutAttemptCount = 0;
let isRefreshing = false;
let refreshSubscribers: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];
const _timeout = 350; // eslint-disable-line no-underscore-dangle

const subscribeToTokenRefresh = (resolve: (token: string) => void, reject: (err: any) => void) => {
    refreshSubscribers.push({ resolve, reject });
};

const onTokenRefreshed = (newToken: string) => {
    refreshSubscribers.forEach((sub) => sub.resolve(newToken));
    refreshSubscribers = [];
};

const onRefreshFailed = (err: any) => {
    refreshSubscribers.forEach((sub) => sub.reject(err));
    refreshSubscribers = [];
};

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

        const userLocale = storedUser?.settings?.locale || 'en-us';
        modifiedConfig.headers['x-localecode'] = userLocale;

        if (token) {
            modifiedConfig.headers.authorization = `Bearer ${token}`;
            modifiedConfig.headers['x-userid'] = userId;
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
        const originalRequest = error.config;

        if (error.response) {
            const is401 = Number(error.response.status) === 401 || Number(error.response.data?.statusCode) === 401;

            // Attempt token refresh on 401 (but not for auth endpoints like login, logout, or refresh)
            const isAuthEndpoint = originalRequest.url?.includes('/users-service/auth');
            if (is401 && !originalRequest.isRetry && !isAuthEndpoint) {
                originalRequest.isRetry = true;

                if (!isRefreshing) {
                    isRefreshing = true;

                    const refreshToken = sessionStorage.getItem('therrRefreshToken')
                        || localStorage.getItem('therrRefreshToken');
                    const storedUser = store.getState().user;
                    const rememberMe = storedUser?.settings?.rememberMe;

                    if (refreshToken) {
                        UsersService.refreshToken(refreshToken, rememberMe)
                            .then(async (response) => {
                                const { idToken: newIdToken, refreshToken: newRefreshToken } = response.data;

                                // Update stored tokens
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                let userDetails: any = {};
                                try {
                                    const storedUserStr = sessionStorage.getItem('therrUser') || localStorage.getItem('therrUser');
                                    userDetails = storedUserStr ? JSON.parse(storedUserStr) : {};
                                } catch (parseErr) {
                                    userDetails = {};
                                }
                                userDetails.idToken = newIdToken;
                                sessionStorage.setItem('therrUser', JSON.stringify(userDetails));
                                sessionStorage.setItem('therrRefreshToken', newRefreshToken);
                                if (rememberMe) {
                                    localStorage.setItem('therrUser', JSON.stringify(userDetails));
                                    localStorage.setItem('therrRefreshToken', newRefreshToken);
                                }

                                // Update Redux state
                                store.dispatch({
                                    type: 'UPDATE_USER',
                                    data: {
                                        details: { idToken: newIdToken },
                                    },
                                });

                                isRefreshing = false;
                                onTokenRefreshed(newIdToken);
                            })
                            .catch((refreshErr) => {
                                isRefreshing = false;
                                onRefreshFailed(refreshErr);

                                // Refresh failed - logout
                                if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
                                    store.dispatch(UsersActions.logout());
                                    logoutAttemptCount += 1;
                                }
                                if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
                                    navigate('/login');
                                }
                            });
                    } else {
                        isRefreshing = false;
                        // No refresh token available - reject queued requests and logout
                        onRefreshFailed(error);
                        if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
                            store.dispatch(UsersActions.logout());
                            logoutAttemptCount += 1;
                        }
                        if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
                            navigate('/login');
                        }
                    }
                }

                // Queue the original request to retry after refresh
                return new Promise((resolve, reject) => {
                    subscribeToTokenRefresh(
                        (newToken: string) => {
                            originalRequest.headers.authorization = `Bearer ${newToken}`;
                            resolve(axios(originalRequest));
                        },
                        (err) => {
                            reject(err);
                        },
                    );
                });
            }

            // Non-refreshable 401 or already retried (skip for auth endpoints — let the form handle the error)
            if (is401 && !isAuthEndpoint) {
                if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
                    store.dispatch(UsersActions.logout());
                    logoutAttemptCount += 1;
                }
                if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
                    navigate('/login');
                }
            }
        } else if (error) {
            if (
                Number(error.statusCode) === 401
                || Number(error.statusCode) === 403
            ) {
                if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
                    store.dispatch(UsersActions.logout());
                    logoutAttemptCount += 1;
                }
                if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
                    navigate('/login');
                }
            }
        }

        if (numLoadings === 0) {
            return Promise.reject(
                (error && error.response && error.response.data) || error,
            );
        }

        if (numLoadings < 2) {
            clearTimeout(timer);
            // store.dispatch(LoaderActions.hideLoader());
        }
        numLoadings -= 1;

        return Promise.reject(
            (error && error.response && error.response.data) || error,
        );
    });
};

export default initInterceptors;
