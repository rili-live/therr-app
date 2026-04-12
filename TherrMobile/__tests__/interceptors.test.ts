import axios, { AxiosAdapter, AxiosResponse } from 'axios';

// Mock SecureStorage
jest.mock('../main/utilities/SecureStorage', () => {
    const store: Record<string, jest.Mock> = {
        getItem: jest.fn(),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
        multiRemove: jest.fn().mockResolvedValue(undefined),
        migrateToSecureStorage: jest.fn().mockResolvedValue(undefined),
    };
    return { __esModule: true, default: store };
});

jest.mock('../main/config/brandConfig', () => ({
    CURRENT_BRAND_VARIATION: 'therr',
}));

jest.mock('../main/utilities/getConfig', () => () => ({
    baseApiGatewayRoute: 'http://localhost:7770',
}));

const mockLogoutAction = { type: 'LOGOUT' };
const mockUpdateTourAction = { type: 'UPDATE_TOUR' };
jest.mock('../main/redux/actions/UsersActions', () => ({
    __esModule: true,
    default: {
        logout: () => mockLogoutAction,
        updateTour: () => mockUpdateTourAction,
    },
}));

jest.mock('../main/socket-io-middleware', () => ({
    socketIO: { disconnect: jest.fn() },
}));

const mockRefreshToken = jest.fn();
jest.mock('therr-react/services', () => ({
    UsersService: {
        refreshToken: (...args: any[]) => mockRefreshToken(...args),
    },
}));

import initInterceptors from '../main/interceptors';
import SecureStorage from '../main/utilities/SecureStorage';

// Mock adapter so retried requests don't hit the network
const mockAdapter: AxiosAdapter = jest.fn().mockImplementation(() => Promise.resolve({
    data: {},
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
} as AxiosResponse));

const flushAsync = async () => {
    // Multiple ticks to flush chained promise callbacks
    // attemptRefresh has a deeper chain (getItem → refreshToken → setItem × 2 → dispatch)
    for (let i = 0; i < 15; i++) {
        await jest.advanceTimersByTimeAsync(0);
    }
};

describe('interceptors', () => {
    let store: any;
    let responseInterceptorError: (error: any) => any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        (SecureStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null);
        (SecureStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined);
        (mockAdapter as jest.Mock).mockClear();

        // Flush pending timers from prior test — mocks must be set up first
        // so any leftover retry timers have valid mocks to call
        jest.runAllTimers();

        store = {
            getState: jest.fn(() => ({
                user: {
                    details: { id: 'user-1', idToken: 'valid-token' },
                    settings: { rememberMe: false, locale: 'en-us' },
                },
            })),
            dispatch: jest.fn(),
        };

        // Clear existing interceptors
        (axios.interceptors.request as any).handlers = [];
        (axios.interceptors.response as any).handlers = [];

        // initInterceptors resets module-level state (isRefreshing, refreshRetryCount, etc.)
        const responseUse = jest.spyOn(axios.interceptors.response, 'use');
        initInterceptors(store);
        responseInterceptorError = responseUse.mock.calls[0][1] as any;
        responseUse.mockRestore();

        // Set mock adapter so retried requests don't hit network
        axios.defaults.adapter = mockAdapter;
    });

    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
        (axios.interceptors.request as any).handlers = [];
        (axios.interceptors.response as any).handlers = [];
    });

    describe('transient vs auth failure classification', () => {
        it('does NOT logout on transient refresh failure (network error)', async () => {
            const error401 = {
                config: { url: '/api/data', _isRetry: false, headers: {} },
                response: { status: 401, data: {} },
                message: 'Network Error',
            };

            (SecureStorage.getItem as jest.Mock).mockResolvedValueOnce('refresh-token');
            mockRefreshToken.mockRejectedValueOnce(new Error('Network Error'));

            // Subscriber promise hangs during transient retry — don't await it
            responseInterceptorError(error401).catch(() => {});
            await flushAsync();

            // attemptRefresh retries after delay — mock the retry to also fail transiently
            // so isRefreshing resets without triggering logout
            (SecureStorage.getItem as jest.Mock).mockResolvedValue('refresh-token');
            mockRefreshToken.mockRejectedValue(new Error('Network Error'));

            // Advance past retry delays to let retries complete
            await jest.advanceTimersByTimeAsync(3000);
            await flushAsync();
            await jest.advanceTimersByTimeAsync(3000);
            await flushAsync();

            expect(store.dispatch).not.toHaveBeenCalledWith(mockLogoutAction);
        });

        it('does NOT logout on 5xx refresh failure', async () => {
            const error401 = {
                config: { url: '/api/data', _isRetry: false, headers: {} },
                response: { status: 401, data: {} },
                message: 'Unauthorized',
            };

            // Mock all retry attempts as 5xx failures
            (SecureStorage.getItem as jest.Mock).mockResolvedValue('refresh-token');
            mockRefreshToken.mockRejectedValue({
                response: { status: 500 },
                message: 'Internal Server Error',
            });

            responseInterceptorError(error401).catch(() => {});
            await flushAsync();

            // Advance past retry delays so retries complete
            await jest.advanceTimersByTimeAsync(3000);
            await flushAsync();
            await jest.advanceTimersByTimeAsync(3000);
            await flushAsync();

            expect(store.dispatch).not.toHaveBeenCalledWith(mockLogoutAction);
        });

        it('DOES logout on 401 refresh failure (expired refresh token)', async () => {
            const error401 = {
                config: { url: '/api/data', _isRetry: false, headers: {} },
                response: { status: 401, data: {} },
                message: 'Unauthorized',
            };

            (SecureStorage.getItem as jest.Mock).mockResolvedValueOnce('refresh-token');
            mockRefreshToken.mockRejectedValueOnce({
                response: { status: 401 },
                statusCode: 401,
            });

            // Attach catch immediately to prevent unhandled rejection, then flush
            const promise = responseInterceptorError(error401).catch(() => {});
            await flushAsync();
            await promise;

            expect(store.dispatch).toHaveBeenCalledWith(mockLogoutAction);
        });

        it('DOES logout on 403 refresh failure (blocked user)', async () => {
            const error401 = {
                config: { url: '/api/data', _isRetry: false, headers: {} },
                response: { status: 401, data: {} },
                message: 'Unauthorized',
            };

            (SecureStorage.getItem as jest.Mock).mockResolvedValueOnce('refresh-token');
            mockRefreshToken.mockRejectedValueOnce({
                response: { status: 403 },
                statusCode: 403,
            });

            // Attach catch immediately to prevent unhandled rejection, then flush
            const promise = responseInterceptorError(error401).catch(() => {});
            await flushAsync();
            await promise;

            expect(store.dispatch).toHaveBeenCalledWith(mockLogoutAction);
        });
    });

    describe('403 handling', () => {
        it('does NOT logout on 403 for non-auth endpoints', async () => {
            const error403 = {
                config: { url: '/api/spaces/123', _isRetry: false, headers: {} },
                response: { status: 403, data: { statusCode: 403 } },
                message: 'Forbidden',
            };

            await responseInterceptorError(error403).catch(() => {});

            expect(store.dispatch).not.toHaveBeenCalledWith(mockLogoutAction);
        });

        it('DOES logout on 403 for auth endpoints', async () => {
            const error403 = {
                config: { url: '/auth/token/refresh', _isRetry: false, headers: {} },
                response: { status: 403, data: { statusCode: 403 } },
                message: 'Forbidden',
            };

            await responseInterceptorError(error403).catch(() => {});

            expect(store.dispatch).toHaveBeenCalledWith(mockLogoutAction);
        });
    });

    describe('retry on retried 401', () => {
        it('DOES logout when retried request gets 401', async () => {
            const error401Retry = {
                config: { url: '/api/data', _isRetry: true, headers: {} },
                response: { status: 401, data: {} },
                message: 'Unauthorized',
            };

            await responseInterceptorError(error401Retry).catch(() => {});

            expect(store.dispatch).toHaveBeenCalledWith(mockLogoutAction);
        });
    });

    describe('non-response errors', () => {
        it('does NOT logout on network errors without auth status', async () => {
            const networkError = {
                config: { url: '/api/data', headers: {} },
                message: 'Network Error',
            };

            await responseInterceptorError(networkError).catch(() => {});

            expect(store.dispatch).not.toHaveBeenCalledWith(mockLogoutAction);
        });

        it('DOES logout on non-response error with 401 statusCode', async () => {
            const authError = {
                config: { url: '/api/data', headers: {} },
                statusCode: 401,
                message: 'Unauthorized',
            };

            await responseInterceptorError(authError).catch(() => {});

            expect(store.dispatch).toHaveBeenCalledWith(mockLogoutAction);
        });
    });

    describe('token refresh success', () => {
        it('stores new tokens and updates Redux after refresh', async () => {
            const error401 = {
                config: { url: '/api/data', _isRetry: false, headers: {}, adapter: mockAdapter },
                response: { status: 401, data: {} },
                message: 'Unauthorized',
            };

            (SecureStorage.getItem as jest.Mock)
                .mockResolvedValueOnce('old-refresh-token')
                .mockResolvedValueOnce(JSON.stringify({ id: '1' }));

            (SecureStorage.setItem as jest.Mock).mockResolvedValue(undefined);

            mockRefreshToken.mockResolvedValueOnce({
                data: { idToken: 'new-id-token', refreshToken: 'new-refresh-token' },
            });

            const promise = responseInterceptorError(error401);

            // Flush multiple times to let the attemptRefresh chain and setItem awaits complete
            for (let i = 0; i < 10; i++) {
                await jest.advanceTimersByTimeAsync(0);
            }

            // The retried request via axios() will go through the adapter mock
            await promise.catch(() => {});

            expect(SecureStorage.setItem).toHaveBeenCalledWith(
                'therrUser',
                expect.stringContaining('new-id-token'),
            );
            expect(SecureStorage.setItem).toHaveBeenCalledWith(
                'therrRefreshToken',
                'new-refresh-token',
            );
            expect(store.dispatch).toHaveBeenCalledWith({
                type: 'UPDATE_USER',
                data: { details: { idToken: 'new-id-token' } },
            });
        });
    });

    describe('retry backoff', () => {
        it('keeps isRefreshing true during retry delay to prevent duplicate refreshes', async () => {
            const error401First = {
                config: { url: '/api/data', _isRetry: false, headers: {} },
                response: { status: 401, data: {} },
                message: 'Unauthorized',
            };

            (SecureStorage.getItem as jest.Mock).mockResolvedValueOnce('refresh-token');
            mockRefreshToken.mockRejectedValueOnce(new Error('Network Error'));

            responseInterceptorError(error401First).catch(() => {});
            await flushAsync();

            // A second 401 during the retry delay (before setTimeout fires) should queue,
            // not start a new refresh — isRefreshing stays true until attemptRefresh retries
            const error401Second = {
                config: { url: '/api/other', _isRetry: false, headers: {} },
                response: { status: 401, data: {} },
                message: 'Unauthorized',
            };

            // Clear call counts but don't advance timers — we're still in the retry delay
            const getItemCallCount = (SecureStorage.getItem as jest.Mock).mock.calls.length;
            responseInterceptorError(error401Second).catch(() => {});
            await flushAsync();

            // getItem should not have been called again — isRefreshing blocks a new refresh
            expect((SecureStorage.getItem as jest.Mock).mock.calls.length).toBe(getItemCallCount);
        });
    });
});
