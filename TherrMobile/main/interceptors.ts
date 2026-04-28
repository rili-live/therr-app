import axios from 'axios';
import { UsersService } from 'therr-react/services';
import { isOfflineError } from 'therr-react/utilities/cacheHelpers';
import SecureStorage from './utilities/SecureStorage';
import { CURRENT_BRAND_VARIATION } from './config/brandConfig';
import getConfig from './utilities/getConfig';
import UsersActions from './redux/actions/UsersActions';
import { socketIO } from './socket-io-middleware';

const MAX_LOGOUT_ATTEMPTS = 3;
const MAX_REFRESH_RETRIES = 2;
const REFRESH_RETRY_DELAY = 3000; // 3 seconds

let timer: any;
let numLoadings = 0;
let logoutAttemptCount = 0;
let isRefreshing = false;
let isLoggingOut = false;
let refreshRetryCount = 0;
let refreshSubscribers: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];
const _timeout = 350;

// Returns true if the error is a definitive auth failure (expired/invalid tokens, blocked user)
const isAuthFailure = (err: any): boolean => {
    const status = err?.response?.status || err?.statusCode;
    return status === 401 || status === 403;
};

// Transient network/gateway errors that should be swallowed on GETs so cached
// Redux state remains visible. Covers:
//   - Pure client-side network failures (isOfflineError)
//   - Node-level socket errors surfaced via the api-gateway (ECONNRESET, ETIMEDOUT, EPIPE)
//   - Gateway responses (502/503/504) that indicate a transient upstream failure
//   - "socket hang up" message variants returned by follow-redirects / http
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECONNABORTED', 'ERR_NETWORK']);
const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const isTransientNetworkError = (err: any): boolean => {
    if (!err) return false;
    if (isOfflineError(err)) return true;

    const code = err?.code || err?.response?.data?.code;
    if (code && TRANSIENT_CODES.has(code)) return true;

    const status = Number(err?.response?.status);
    if (TRANSIENT_STATUSES.has(status)) return true;

    const msg = err?.message || err?.response?.data?.message;
    if (typeof msg === 'string' && msg.toLowerCase().includes('socket hang up')) return true;

    return false;
};

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
        // Suppress further refresh-and-retry on subsequent 401s so concurrent
        // in-flight requests don't fan out into the rejection cascade we saw
        // when /auth/logout itself returns 401 with an expired idToken.
        isLoggingOut = true;
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

const attemptRefresh = (store) => {
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
            refreshRetryCount = 0;
            onTokenRefreshed(newIdToken);
        })
        .catch((refreshErr) => {
            if (isAuthFailure(refreshErr)) {
                // Definitive auth failure (expired/invalid refresh token, blocked user)
                isRefreshing = false;
                refreshRetryCount = 0;
                onRefreshFailed(refreshErr);
                handleLogout(store);
            } else if (refreshRetryCount < MAX_REFRESH_RETRIES) {
                // Transient failure (network error, 5xx, timeout) — retry after delay
                // Keep isRefreshing = true during the delay so no duplicate refresh fires
                refreshRetryCount += 1;
                if (__DEV__) {
                    console.log(`[Interceptor] Refresh failed (transient), retry ${refreshRetryCount}/${MAX_REFRESH_RETRIES}`);
                }
                setTimeout(() => {
                    attemptRefresh(store);
                }, REFRESH_RETRY_DELAY);
            } else {
                // Exhausted retries — reject queued requests but do NOT logout
                // The refresh token is still intact for the next app session
                isRefreshing = false;
                refreshRetryCount = 0;
                onRefreshFailed(refreshErr);
            }
        });
};

const initInterceptors = (
    store,
    baseUrl = getConfig().baseApiGatewayRoute,
    timeout = _timeout
) => {
    // Reset module-level state (safe for re-initialization)
    isRefreshing = false;
    isLoggingOut = false;
    refreshRetryCount = 0;
    refreshSubscribers = [];
    logoutAttemptCount = 0;

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
            isLoggingOut = false;
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
            const isGet = originalRequest?.method?.toLowerCase() === 'get';
            const isTransient = isTransientNetworkError(error);

            // Graceful transient-error handling: swallow transient network/gateway
            // errors on GET requests so cached Redux state remains visible without UI errors.
            // Moved above the generic error log so transient failures don't spam the console.
            if (isTransient && isGet) {
                if (__DEV__) {
                    console.log('[Interceptor] Transient GET error swallowed:', originalRequest?.url, error?.code || error?.message);
                }
                numLoadings = Math.max(0, numLoadings - 1);
                return Promise.resolve({ data: {}, isOfflineFallback: true });
            }

            if (__DEV__ && !isTransient) {
                console.log('[Interceptor Error]', error?.config?.url, error?.response?.status, error?.message);
            }

            if (error.response) {
                const is401 = Number(error.response.status) === 401 || Number(error.response.data?.statusCode) === 401;
                const is403 = Number(error.response.status) === 403 || Number(error.response.data?.statusCode) === 403;
                const url = originalRequest?.url || '';
                // Skip refresh-and-retry on auth tear-down endpoints. /auth/logout
                // 401s are expected when the idToken is expired (which is often
                // why we're logging out in the first place) and queueing them
                // onto the refresh subscriber list produces unhandled rejections
                // when the refresh itself fails.
                const isAuthTeardownUrl = url.includes('/auth/token/refresh') || url.includes('/auth/logout');

                // Once a logout is in flight, stop running the auth-recovery
                // path on every concurrent 401/403 — let those requests fail
                // quietly so they don't fan out into more refresh attempts or
                // duplicate logout dispatches.
                if (isLoggingOut) {
                    if (numLoadings < 2) {
                        clearTimeout(timer);
                    }
                    numLoadings = Math.max(0, numLoadings - 1);
                    return Promise.reject(
                        (error && error.response && error.response.data) || error
                    );
                }

                // Attempt token refresh on 401 (but not for refresh/logout requests or 403s)
                if (is401 && !originalRequest._isRetry && !isAuthTeardownUrl) {
                    originalRequest._isRetry = true;

                    if (!isRefreshing) {
                        isRefreshing = true;
                        attemptRefresh(store);
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

                // Only logout for 401 on retried requests (refresh succeeded but new token still rejected)
                // or 403 on auth-specific endpoints (blocked user, invalid token type)
                if (is401 && originalRequest._isRetry) {
                    handleLogout(store);
                } else if (is403 && url.includes('/auth')) {
                    handleLogout(store);
                }
            } else if (error) {
                if (isAuthFailure(error) && !isLoggingOut) {
                    // Only logout for definitive auth failures without a response object
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
