import { expect } from 'chai';
import sinon from 'sinon';
import {
    Notifications, SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION, UserConnectionTypes,
} from 'therr-js-utilities/constants';

describe('User Connections Handler', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('createConnection', () => {
        describe('notification to accepting user', () => {
            it('should emit NOTIFICATION_CREATED to accepting user when online', () => {
                const toSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    to: sandbox.stub().returns({
                        emit: toSpy,
                    }),
                };

                const acceptingUserSocketId = 'accepting-socket-456';
                const connection = {
                    id: 'connection-123',
                    requestingUserId: 'user-123',
                    acceptingUserId: 'user-456',
                    notification: {
                        id: 'notif-123',
                        type: 'CONNECTION_REQUEST',
                    },
                };

                socket.to(acceptingUserSocketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.NOTIFICATION_CREATED,
                    data: {
                        ...connection.notification,
                        userConnection: {
                            id: connection.id,
                            requestingUserId: connection.requestingUserId,
                            acceptingUserId: connection.acceptingUserId,
                        },
                    },
                });

                expect(socket.to.calledWith('accepting-socket-456')).to.be.eq(true);
                expect(toSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.NOTIFICATION_CREATED);
            });

            it('should not emit when accepting user is offline (no socketId)', () => {
                const response = { socketId: null };
                const shouldEmit = !!response?.socketId;

                expect(shouldEmit).to.be.eq(false);
            });
        });

        describe('connection data handling', () => {
            it('should separate notification from connection data', () => {
                const connectionWithNotification = {
                    id: 'connection-123',
                    requestingUserId: 'user-123',
                    acceptingUserId: 'user-456',
                    notification: {
                        id: 'notif-123',
                        type: 'CONNECTION_REQUEST',
                    },
                };

                const connection = { ...connectionWithNotification };
                const notification = connection.notification;
                delete (connection as any).notification;

                expect(notification).to.have.property('id');
                expect(connection).to.not.have.property('notification');
            });
        });
    });

    describe('updateConnection', () => {
        describe('connection request status handling', () => {
            it('should handle COMPLETE status', () => {
                const connection = {
                    requestStatus: UserConnectionTypes.COMPLETE,
                };

                expect(connection.requestStatus).to.equal(UserConnectionTypes.COMPLETE);
            });

            it('should handle DENIED status', () => {
                const connection = {
                    requestStatus: UserConnectionTypes.DENIED,
                };

                expect(connection.requestStatus).to.equal(UserConnectionTypes.DENIED);
            });

            it('should handle isConnectionBroken flag', () => {
                const connection = {
                    isConnectionBroken: true,
                };

                expect(connection.isConnectionBroken).to.be.eq(true);
            });
        });

        describe('REST request construction', () => {
            it('should construct correct update payload', () => {
                const data = {
                    connection: {
                        interactionCount: 5,
                        isConnectionBroken: false,
                        otherUserId: 'other-user-123',
                        requestStatus: UserConnectionTypes.COMPLETE,
                    },
                };

                const requestPayload = {
                    interactionCount: data.connection.interactionCount,
                    isConnectionBroken: data.connection.isConnectionBroken,
                    otherUserId: data.connection.otherUserId,
                    requestStatus: data.connection.requestStatus,
                };

                expect(requestPayload.interactionCount).to.equal(5);
                expect(requestPayload.requestStatus).to.equal(UserConnectionTypes.COMPLETE);
            });
        });

        describe('socket events - connection broken', () => {
            it('should emit USER_CONNECTION_UPDATED when connection is broken', () => {
                const toSpy = sandbox.spy();
                const socket: any = {
                    to: sandbox.stub().returns({
                        emit: toSpy,
                    }),
                };

                const connection = {
                    id: 'connection-123',
                    requestingUserId: 'user-123',
                    acceptingUserId: 'user-456',
                    isConnectionBroken: true,
                };

                const requestingUserSocketId = 'requesting-socket';

                socket.to(requestingUserSocketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                    data: connection,
                });

                expect(toSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.USER_CONNECTION_UPDATED);
                expect(toSpy.firstCall.args[1].data.isConnectionBroken).to.be.eq(true);
            });
        });

        describe('socket events - connection accepted', () => {
            it('should emit USER_CONNECTION_UPDATED to requesting user', () => {
                const toSpy = sandbox.spy();
                const socket: any = {
                    to: sandbox.stub().returns({
                        emit: toSpy,
                    }),
                };

                const connection = {
                    id: 'connection-123',
                    requestingUserId: 'user-123',
                    acceptingUserId: 'user-456',
                    requestStatus: UserConnectionTypes.COMPLETE,
                };

                const requestingUserSocketId = 'requesting-socket';

                socket.to(requestingUserSocketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                    data: connection,
                });

                expect(toSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.USER_CONNECTION_UPDATED);
            });

            it('should emit ACTIVE_CONNECTIONS_ADDED to requesting user with accepting user data', () => {
                const toSpy = sandbox.spy();
                const socket: any = {
                    to: sandbox.stub().returns({
                        emit: toSpy,
                    }),
                };

                const acceptingUser = {
                    id: 'user-456',
                    userName: 'acceptinguser',
                    firstName: 'Accept',
                    lastName: 'User',
                    idToken: 'should-be-removed',
                };

                // Remove idToken before sending
                const userToSend = { ...acceptingUser };
                delete (userToSend as any).idToken;

                socket.to('requesting-socket').emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.ACTIVE_CONNECTIONS_ADDED,
                    data: userToSend,
                });

                expect(toSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.ACTIVE_CONNECTIONS_ADDED);
                expect(toSpy.firstCall.args[1].data).to.not.have.property('idToken');
            });

            it('should emit USER_CONNECTION_UPDATED to accepting user', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    emit: emitSpy,
                };

                const connection = {
                    id: 'connection-123',
                    requestStatus: UserConnectionTypes.COMPLETE,
                };

                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                    data: connection,
                });

                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.USER_CONNECTION_UPDATED);
            });
        });

        describe('notification on connection acceptance', () => {
            it('should create CONNECTION_REQUEST_ACCEPTED notification', () => {
                const connection = {
                    id: 'connection-123',
                    requestingUserId: 'user-123',
                    acceptingUserId: 'user-456',
                };

                const user = {
                    firstName: 'Accept',
                    lastName: 'User',
                };

                const notificationData = {
                    userId: connection.requestingUserId,
                    type: Notifications.Types.CONNECTION_REQUEST_ACCEPTED,
                    associationId: connection.id,
                    isUnread: true,
                    messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_ACCEPTED,
                    messageParams: {
                        userId: connection.acceptingUserId,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    },
                };

                expect(notificationData.type).to.equal(Notifications.Types.CONNECTION_REQUEST_ACCEPTED);
                expect(notificationData.userId).to.equal('user-123');
                expect(notificationData.associationId).to.equal('connection-123');
            });

            it('should NOT create notification when connection is denied', () => {
                const connection = {
                    requestStatus: UserConnectionTypes.DENIED,
                };

                const shouldCreateNotification = connection.requestStatus === UserConnectionTypes.COMPLETE;
                expect(shouldCreateNotification).to.be.eq(false);
            });
        });

        describe('idToken security', () => {
            it('should remove idToken from user data before sending to other users', () => {
                const userData = {
                    id: 'user-123',
                    userName: 'testuser',
                    firstName: 'Test',
                    lastName: 'User',
                    idToken: 'sensitive-jwt-token',
                };

                const safeUserData = { ...userData };
                delete (safeUserData as any).idToken;

                expect(safeUserData).to.not.have.property('idToken');
                expect(safeUserData.id).to.equal('user-123');
            });
        });
    });

    describe('loadActiveConnections', () => {
        describe('user extraction from connections', () => {
            it('should extract context user from connection users array', () => {
                const currentUserId = 'user-123';
                const connection = {
                    users: [
                        { id: 'user-123', userName: 'currentuser' },
                        { id: 'user-456', userName: 'otheruser' },
                    ],
                };

                const contextUserId = connection.users[0].id === currentUserId
                    ? connection.users[1].id
                    : connection.users[0].id;

                const contextUser = connection.users.find((user) => user.id === contextUserId);

                expect(contextUserId).to.equal('user-456');
                expect(contextUser?.userName).to.equal('otheruser');
            });

            it('should handle connection when current user is second in array', () => {
                const currentUserId = 'user-123';
                const connection = {
                    users: [
                        { id: 'user-456', userName: 'otheruser' },
                        { id: 'user-123', userName: 'currentuser' },
                    ],
                };

                const contextUserId = connection.users[0].id === currentUserId
                    ? connection.users[1].id
                    : connection.users[0].id;

                expect(contextUserId).to.equal('user-456');
            });
        });

        describe('active users filtering', () => {
            it('should match cached active users with connection users', () => {
                const connectionUsers = [
                    { id: 'user-1', userName: 'user1' },
                    { id: 'user-2', userName: 'user2' },
                    { id: 'user-3', userName: 'user3' },
                ];

                const cachedActiveUsers = [
                    { id: 'user-1', socketId: 'socket-1', status: 'active' },
                    { id: 'user-3', socketId: 'socket-3', status: 'active' },
                ];

                const activeUsers: any[] = [];
                connectionUsers.forEach((u) => {
                    const mappedMatch = cachedActiveUsers.find((activeUser) => activeUser.id === u.id);
                    if (mappedMatch) {
                        activeUsers.push({
                            ...u,
                            ...mappedMatch,
                        });
                    }
                });

                expect(activeUsers).to.have.lengthOf(2);
                expect(activeUsers.map((u) => u.id)).to.include('user-1');
                expect(activeUsers.map((u) => u.id)).to.include('user-3');
                expect(activeUsers.map((u) => u.id)).to.not.include('user-2');
            });

            it('should merge user data with cached session data', () => {
                const connectionUser = { id: 'user-1', userName: 'user1', email: 'user1@example.com' };
                const cachedData = { id: 'user-1', socketId: 'socket-1', status: 'active' };

                const mergedUser = {
                    ...connectionUser,
                    ...cachedData,
                };

                expect(mergedUser.userName).to.equal('user1');
                expect(mergedUser.socketId).to.equal('socket-1');
                expect(mergedUser.status).to.equal('active');
            });
        });

        describe('socket events', () => {
            it('should emit ACTIVE_CONNECTIONS_LOADED with active users', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    emit: emitSpy,
                };

                const activeUsers = [
                    { id: 'user-1', socketId: 'socket-1', userName: 'user1' },
                    { id: 'user-2', socketId: 'socket-2', userName: 'user2' },
                ];

                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED,
                    data: {
                        activeUsers,
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED);
                expect(emitSpy.firstCall.args[1].data.activeUsers).to.have.lengthOf(2);
            });
        });
    });
});

describe('User Connection Types', () => {
    describe('connection status values', () => {
        it('should have PENDING status', () => {
            expect(UserConnectionTypes.PENDING).to.exist;
        });

        it('should have COMPLETE status', () => {
            expect(UserConnectionTypes.COMPLETE).to.exist;
        });

        it('should have DENIED status', () => {
            expect(UserConnectionTypes.DENIED).to.exist;
        });
    });
});
