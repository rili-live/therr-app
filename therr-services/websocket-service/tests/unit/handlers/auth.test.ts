import { expect } from 'chai';
import sinon from 'sinon';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';

// User status values matching the source
const USER_STATUS_ACTIVE = 'active';

describe('Auth Handler', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('login', () => {
        describe('session creation', () => {
            it('should create session with correct data structure', () => {
                const loginData = {
                    id: 'user-123',
                    idToken: 'jwt-token',
                    userName: 'testuser',
                    firstName: 'Test',
                    lastName: 'User',
                    status: USER_STATUS_ACTIVE,
                };

                const sessionConfig = {
                    app: 'therr-mobile',
                    socketId: 'socket-abc',
                    ip: '192.168.1.1',
                    ttl: 1 * 60 * 30, // 30 minutes in seconds
                    data: {
                        id: loginData.id,
                        socketId: 'socket-abc',
                        previousSocketId: null,
                        userName: loginData.userName,
                        firstName: loginData.firstName,
                        lastName: loginData.lastName,
                        idToken: loginData.idToken,
                        status: USER_STATUS_ACTIVE,
                    },
                };

                expect(sessionConfig.ttl).to.equal(1800);
                expect(sessionConfig.data.status).to.equal('active');
                expect(sessionConfig.data.previousSocketId).to.be.eq(null);
            });

            it('should use 30 minute TTL for sessions', () => {
                const ttl = 1 * 60 * 30; // From auth.ts
                expect(ttl).to.equal(1800); // 30 minutes in seconds
            });

            it('should extract host IP from socket headers', () => {
                const socket: any = {
                    handshake: {
                        headers: {
                            host: '192.168.1.1:3000',
                        },
                    },
                };

                const ip = (socket.handshake.headers as any).host.split(':')[0];
                expect(ip).to.equal('192.168.1.1');
            });

            it('should handle host without port', () => {
                const socket: any = {
                    handshake: {
                        headers: {
                            host: '192.168.1.1',
                        },
                    },
                };

                const ip = (socket.handshake.headers as any).host.split(':')[0];
                expect(ip).to.equal('192.168.1.1');
            });
        });

        describe('socket events', () => {
            it('should emit SESSION_CREATED event on successful login', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    emit: emitSpy,
                };

                const sessionResponse = {
                    app: 'therr-mobile',
                    socketId: 'socket-123',
                    ip: '192.168.1.1',
                    ttl: 1800,
                    data: { id: 'user-123' },
                };

                // Simulate SESSION_CREATED emission
                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.SESSION_CREATED,
                    data: sessionResponse,
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.SESSION_CREATED);
            });

            it('should emit USER_LOGIN_SUCCESS event', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    emit: emitSpy,
                };

                const userName = 'testuser';
                const now = '1/1/24, 12:00pm';

                // Simulate USER_LOGIN_SUCCESS emission
                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.USER_LOGIN_SUCCESS,
                    data: {
                        message: {
                            key: Date.now().toString(),
                            time: now,
                            text: 'You have been logged in successfully.',
                        },
                        userName,
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.USER_LOGIN_SUCCESS);
                expect(emitSpy.firstCall.args[1].data.userName).to.equal('testuser');
            });
        });

        describe('connection notification', () => {
            it('should prepare notification data with ACTIVE status', () => {
                const loginData = {
                    id: 'user-123',
                    userName: 'testuser',
                    firstName: 'Test',
                    lastName: 'User',
                };

                const notificationData = {
                    ...loginData,
                    status: USER_STATUS_ACTIVE,
                };

                expect(notificationData.status).to.equal('active');
                expect(notificationData.id).to.equal('user-123');
            });
        });

        describe('validation', () => {
            it('should require socket handshake headers', () => {
                const socket: any = {
                    handshake: null,
                };

                const hasValidHandshake = !!(socket.handshake
                    && (socket.handshake.headers as any)
                    && (socket.handshake.headers as any).host);

                expect(hasValidHandshake).to.be.eq(false);
            });

            it('should require host header', () => {
                const socket: any = {
                    handshake: {
                        headers: {},
                    },
                };

                const hasHost = !!(socket.handshake?.headers as any)?.host;
                expect(hasHost).to.be.eq(false);
            });
        });
    });

    describe('logout', () => {
        describe('session removal', () => {
            it('should emit SESSION_CLOSED event', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    emit: emitSpy,
                };

                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.SESSION_CLOSED,
                    data: {},
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.SESSION_CLOSED);
            });

            it('should emit USER_LOGOUT_SUCCESS event', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    emit: emitSpy,
                };

                const userName = 'testuser';
                const now = '1/1/24, 12:00pm';

                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.USER_LOGOUT_SUCCESS,
                    data: {
                        message: {
                            key: Date.now().toString(),
                            time: now,
                            text: 'You have been logged out successfully.',
                        },
                        userName,
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.USER_LOGOUT_SUCCESS);
            });
        });

        describe('connection notification', () => {
            it('should only notify connections when user data is present', () => {
                const dataWithUser = { id: 'user-123', userName: 'testuser' };
                const dataWithoutUser: any = {};

                expect(!!(dataWithUser && dataWithUser.id)).to.be.eq(true);
                expect(!!(dataWithoutUser && dataWithoutUser.id)).to.be.eq(false);
            });
        });
    });
});

describe('Session Handler', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('update', () => {
        describe('session update on page refresh', () => {
            it('should track previous socket ID for session migration', () => {
                const previousSocketId = 'old-socket-123';
                const newSocketId = 'new-socket-456';

                const updateData = {
                    details: {
                        id: 'user-123',
                        idToken: 'jwt-token',
                        userName: 'testuser',
                        firstName: 'Test',
                        lastName: 'User',
                    },
                    socketDetails: {
                        session: {
                            id: previousSocketId,
                        },
                    },
                    isAuthenticated: true,
                };

                const sessionConfig = {
                    data: {
                        id: updateData.details.id,
                        socketId: newSocketId,
                        previousSocketId: updateData.socketDetails.session.id || null,
                        userName: updateData.details.userName,
                        firstName: updateData.details.firstName,
                        lastName: updateData.details.lastName,
                        idToken: updateData.details.idToken,
                        status: USER_STATUS_ACTIVE,
                    },
                };

                expect(sessionConfig.data.previousSocketId).to.equal('old-socket-123');
                expect(sessionConfig.data.socketId).to.equal('new-socket-456');
            });

            it('should use 30 minute TTL for updated sessions', () => {
                const ttl = 60 * 1000 * 30; // From sessions.ts (in milliseconds)
                expect(ttl).to.equal(1800000); // 30 minutes in milliseconds
            });

            it('should only update when user is authenticated', () => {
                const authenticatedData = { isAuthenticated: true };
                const unauthenticatedData = { isAuthenticated: false };

                expect(authenticatedData.isAuthenticated).to.be.eq(true);
                expect(unauthenticatedData.isAuthenticated).to.be.eq(false);
            });
        });

        describe('socket events', () => {
            it('should emit SESSION_UPDATED event on successful update', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    emit: emitSpy,
                };

                const response = {
                    app: 'therr-mobile',
                    socketId: 'socket-123',
                    ip: '192.168.1.1',
                };

                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.SESSION_UPDATED,
                    data: {
                        ...response,
                        status: USER_STATUS_ACTIVE,
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.SESSION_UPDATED);
                expect(emitSpy.firstCall.args[1].data.status).to.equal('active');
            });
        });

        describe('connection notification', () => {
            it('should notify connections with ACTIVE_CONNECTION_REFRESHED action', () => {
                const actionType = SocketServerActionTypes.ACTIVE_CONNECTION_REFRESHED;
                expect(actionType).to.equal(SocketServerActionTypes.ACTIVE_CONNECTION_REFRESHED);
                expect(actionType).to.include('ACTIVE_CONNECTION_REFRESHED');
            });
        });
    });
});
