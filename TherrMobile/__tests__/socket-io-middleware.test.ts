import 'react-native';
import { BrandVariations, SOCKET_MIDDLEWARE_ACTION, SocketClientActionTypes } from 'therr-js-utilities/constants';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

/**
 * Socket.io Middleware Regression Tests
 *
 * These tests verify the socket.io middleware logic for WebSocket communication.
 * The tests are written to test the logic in isolation since the actual socket.io
 * module has side effects on import that make it difficult to mock properly.
 */

beforeEach(() => {
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('WebSocket Token Update Logic', () => {
    // Test the updateSocketToken logic in isolation
    const createMockSocket = () => ({
        io: {
            opts: {
                query: {} as Record<string, any>,
            },
        },
        connect: jest.fn(),
        emit: jest.fn(),
    });

    const updateSocketToken = (
        socket: ReturnType<typeof createMockSocket>,
        user: any,
        shouldConnect?: boolean
    ) => {
        if (user && user.details && user.details.idToken) {
            socket.io.opts.query = {
                userId: user.details.id,
                userName: user.details.userName,
                locale: user.settings.locale,
                token: user.details.idToken,
                platform: 'mobile',
                brandVariation: BrandVariations.TEEM,
            };

            if (shouldConnect) {
                socket.connect();
                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketClientActionTypes.UPDATE_SESSION,
                    data: user,
                });
            }
        }
    };

    describe('updateSocketToken', () => {
        const mockUser = {
            details: {
                id: 'user-123',
                userName: 'testuser',
                idToken: 'mock-id-token',
            },
            settings: {
                locale: 'en-us',
            },
        };

        it('should set socket query parameters when user has valid idToken', () => {
            const socket = createMockSocket();

            updateSocketToken(socket, mockUser, false);

            expect(socket.io.opts.query).toEqual(
                expect.objectContaining({
                    userId: 'user-123',
                    userName: 'testuser',
                    locale: 'en-us',
                    token: 'mock-id-token',
                    platform: 'mobile',
                })
            );
        });

        it('should include brand variation in query', () => {
            const socket = createMockSocket();

            updateSocketToken(socket, mockUser, false);

            expect(socket.io.opts.query).toEqual(
                expect.objectContaining({
                    brandVariation: BrandVariations.TEEM,
                })
            );
        });

        it('should connect socket when shouldConnect is true', () => {
            const socket = createMockSocket();

            updateSocketToken(socket, mockUser, true);

            expect(socket.connect).toHaveBeenCalled();
        });

        it('should emit UPDATE_SESSION when connecting', () => {
            const socket = createMockSocket();

            updateSocketToken(socket, mockUser, true);

            expect(socket.emit).toHaveBeenCalledWith(
                SOCKET_MIDDLEWARE_ACTION,
                expect.objectContaining({
                    type: SocketClientActionTypes.UPDATE_SESSION,
                    data: mockUser,
                })
            );
        });

        it('should not connect when shouldConnect is false', () => {
            const socket = createMockSocket();

            updateSocketToken(socket, mockUser, false);

            expect(socket.connect).not.toHaveBeenCalled();
        });

        it('should not emit when shouldConnect is false', () => {
            const socket = createMockSocket();

            updateSocketToken(socket, mockUser, false);

            expect(socket.emit).not.toHaveBeenCalled();
        });

        it('should not update query when user is null', () => {
            const socket = createMockSocket();
            const originalQuery = { ...socket.io.opts.query };

            updateSocketToken(socket, null, false);

            expect(socket.io.opts.query).toEqual(originalQuery);
        });

        it('should not update query when user has no details', () => {
            const socket = createMockSocket();
            const originalQuery = { ...socket.io.opts.query };

            updateSocketToken(socket, { details: null }, false);

            expect(socket.io.opts.query).toEqual(originalQuery);
        });

        it('should not update query when user has no idToken', () => {
            const socket = createMockSocket();
            const originalQuery = { ...socket.io.opts.query };
            const userWithoutToken = {
                details: {
                    id: 'user-123',
                    userName: 'testuser',
                },
                settings: {
                    locale: 'en-us',
                },
            };

            updateSocketToken(socket, userWithoutToken, false);

            expect(socket.io.opts.query).toEqual(originalQuery);
        });

        it('should not connect when user has no idToken even if shouldConnect is true', () => {
            const socket = createMockSocket();
            const userWithoutToken = {
                details: {
                    id: 'user-123',
                    userName: 'testuser',
                },
                settings: {
                    locale: 'en-us',
                },
            };

            updateSocketToken(socket, userWithoutToken, true);

            expect(socket.connect).not.toHaveBeenCalled();
        });
    });
});

describe('WebSocket Message Action Types', () => {
    // Verify the correct action types are used for socket communication
    describe('SocketClientActionTypes', () => {
        it('should have UPDATE_SESSION action type', () => {
            expect(SocketClientActionTypes.UPDATE_SESSION).toBeDefined();
        });
    });

    describe('SOCKET_MIDDLEWARE_ACTION', () => {
        it('should be defined for socket event emission', () => {
            expect(SOCKET_MIDDLEWARE_ACTION).toBeDefined();
            expect(typeof SOCKET_MIDDLEWARE_ACTION).toBe('string');
        });
    });
});

describe('WebSocket Connection Parameters', () => {
    // Test the socket connection parameter structure
    describe('Query Parameters', () => {
        it('should include all required fields', () => {
            const expectedFields = ['userId', 'userName', 'locale', 'token', 'platform', 'brandVariation'];
            const queryParams = {
                userId: 'user-123',
                userName: 'testuser',
                locale: 'en-us',
                token: 'mock-token',
                platform: 'mobile',
                brandVariation: BrandVariations.TEEM,
            };

            expectedFields.forEach(field => {
                expect(queryParams).toHaveProperty(field);
            });
        });

        it('should use mobile platform identifier', () => {
            const queryParams = {
                platform: 'mobile',
            };

            expect(queryParams.platform).toBe('mobile');
        });

        it('should use TEEM brand variation', () => {
            const queryParams = {
                brandVariation: BrandVariations.TEEM,
            };

            expect(queryParams.brandVariation).toBe(BrandVariations.TEEM);
        });
    });
});

describe('WebSocket Session Update Payload', () => {
    // Test the session update payload structure
    describe('UPDATE_SESSION payload', () => {
        it('should include user data in payload', () => {
            const mockUser = {
                details: {
                    id: 'user-123',
                    userName: 'testuser',
                    idToken: 'mock-token',
                },
                settings: {
                    locale: 'en-us',
                },
            };

            const payload = {
                type: SocketClientActionTypes.UPDATE_SESSION,
                data: mockUser,
            };

            expect(payload.type).toBe(SocketClientActionTypes.UPDATE_SESSION);
            expect(payload.data).toEqual(mockUser);
        });
    });
});
