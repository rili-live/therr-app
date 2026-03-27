import axios from 'axios';
// import { AlertActions } from './library/alerts';
// import { LoaderActions } from './library/loader';
import UsersService from 'therr-react/services/UsersService';
import SecureStorage from './utilities/SecureStorage';
import { CURRENT_BRAND_VARIATION } from './config/brandConfig';
import getConfig from './utilities/getConfig';
import UsersActions from './redux/actions/UsersActions';
import { socketIO } from './socket-io-middleware';

const MAX_LOGOUT_ATTEMPTS = 3;

let timer: any;
let numLoadings = 0;
let logoutAttemptCount = 0;
let isRefreshing = false;
let refreshSubscribers: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];
const _timeout = 350;

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

const handleLogout = (store) => {
    if (logoutAttemptCount < MAX_LOGOUT_ATTEMPTS) {
        const storedUser = store.getState().user;
        if (storedUser?.details?.id) {
            store.dispatch(UsersActions.updateTour({
                isTouring: false,
                isNavigationTouring: false,
            }, storedUser?.details?.id));
        }
        store.dispatch(UsersActions.logout());
        logoutAttemptCount += 1;
    }
};

const initInterceptors = (
    store,
    baseUrl = getConfig().baseApiGatewayRoute,
    timeout = _timeout
) => {
    // Global axios config
    // Use fetch adapter instead of xhr — RN 0.80's XMLHttpRequest polyfill
    // is incompatible with axios 1.x's xhr adapter
    axios.defaults.adapter = 'fetch';
    axios.defaults.baseURL = baseUrl;
    axios.defaults.headers['x-platform'] = 'mobile';
    // NICHE - Brand variation is now set via config/brandConfig.ts
    axios.defaults.headers['x-brand-variation'] = CURRENT_BRAND_VARIATION;

    // Global axios interceptor
    axios.interceptors.request.use((config) => {
        const modifiedConfig = config;
        const storedUser = store.getState().user;
        const token = storedUser?.details?.idToken;
        const userId = storedUser?.details?.id;
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

            return response;
        },
        (error) => {
            const originalRequest = error.config;

            if (__DEV__) {
                console.log('[Interceptor Error]', error?.config?.url, error?.response?.status, error?.message);
            }

            if (error.response) {
                const is401 = Number(error.response.status) === 401 || Number(error.response.data?.statusCode) === 401;
                const is403 = Number(error.response.status) === 403 || Number(error.response.data?.statusCode) === 403;

                // Attempt token refresh on 401 (but not for refresh requests or 403s)
                if (is401 && !originalRequest._isRetry && !originalRequest.url?.includes('/auth/token/refresh')) {
                    originalRequest._isRetry = true;

                    if (!isRefreshing) {
                        isRefreshing = true;

                        SecureStorage.getItem('therrRefreshToken')
                            .then((refreshToken) => {
                                if (!refreshToken) {
                                    throw new Error('No refresh token available');
                                }

                                const storedUser = store.getState().user;
                                const rememberMe = storedUser?.settings?.rememberMe;

                                return UsersService.refreshToken(refreshToken, rememberMe);
                            })
                            .then(async (response) => {
                                const { idToken: newIdToken, refreshToken: newRefreshToken } = response.data;

                                // Update stored tokens
                                const userDetailsStr = await SecureStorage.getItem('therrUser');
                                const userDetails = JSON.parse(userDetailsStr || '{}');
                                userDetails.idToken = newIdToken;
                                await SecureStorage.setItem('therrUser', JSON.stringify(userDetails));
                                await SecureStorage.setItem('therrRefreshToken', newRefreshToken);

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
                                handleLogout(store);
                            });
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

                if (is401 || is403) {
                    handleLogout(store);
                }
            } else if (error) {
                if (
                    Number(error.statusCode) === 401 ||
                    Number(error.statusCode) === 403
                ) {
                    socketIO.disconnect();
                    handleLogout(store);
                }
            }

            if (numLoadings === 0) {
                return Promise.reject(
                    (error && error.response && error.response.data) || error
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
