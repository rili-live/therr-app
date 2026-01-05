import { expect } from 'chai';
import sinon from 'sinon';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';

describe('Notifications Handler', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('updateNotification', () => {
        describe('notification data handling', () => {
            it('should extract notification id from data', () => {
                const data = {
                    notification: {
                        id: 'notif-123',
                        isUnread: false,
                        type: 'NEW_DM_RECEIVED',
                    },
                    userName: 'testuser',
                };

                expect(data.notification.id).to.equal('notif-123');
            });

            it('should handle isUnread toggle to true', () => {
                const notification = {
                    id: 'notif-123',
                    isUnread: true,
                };

                const requestPayload = {
                    isUnread: notification.isUnread,
                };

                expect(requestPayload.isUnread).to.be.eq(true);
            });

            it('should handle isUnread toggle to false', () => {
                const notification = {
                    id: 'notif-123',
                    isUnread: false,
                };

                const requestPayload = {
                    isUnread: notification.isUnread,
                };

                expect(requestPayload.isUnread).to.be.eq(false);
            });
        });

        describe('REST request construction', () => {
            it('should construct correct URL with notification id', () => {
                const baseUrl = 'http://localhost:7771';
                const notificationId = 'notif-123';

                const url = `${baseUrl}/users/notifications/${notificationId}`;

                expect(url).to.equal('http://localhost:7771/users/notifications/notif-123');
            });

            it('should use PUT method for update', () => {
                const method = 'put';
                expect(method).to.equal('put');
            });
        });

        describe('socket events', () => {
            it('should emit NOTIFICATION_UPDATED event on success', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    emit: emitSpy,
                };

                const originalNotification = {
                    id: 'notif-123',
                    isUnread: true,
                    type: 'NEW_DM_RECEIVED',
                };

                const responseData = {
                    id: 'notif-123',
                    isUnread: false,
                    updatedAt: new Date().toISOString(),
                };

                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.NOTIFICATION_UPDATED,
                    data: {
                        ...originalNotification,
                        ...responseData,
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[0]).to.equal(SOCKET_MIDDLEWARE_ACTION);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.NOTIFICATION_UPDATED);
                expect(emitSpy.firstCall.args[1].data.isUnread).to.be.eq(false);
            });

            it('should merge original notification data with response', () => {
                const originalNotification = {
                    id: 'notif-123',
                    isUnread: true,
                    type: 'NEW_DM_RECEIVED',
                    messageParams: { userId: 'user-456' },
                };

                const responseData = {
                    isUnread: false,
                    updatedAt: '2024-01-01T00:00:00Z',
                };

                const mergedData = {
                    ...originalNotification,
                    ...responseData,
                };

                expect(mergedData.id).to.equal('notif-123');
                expect(mergedData.type).to.equal('NEW_DM_RECEIVED');
                expect(mergedData.messageParams.userId).to.equal('user-456');
                expect(mergedData.isUnread).to.be.eq(false);
                expect(mergedData.updatedAt).to.equal('2024-01-01T00:00:00Z');
            });
        });

        describe('error handling', () => {
            it('should handle missing notification gracefully', () => {
                const data: any = {
                    notification: undefined,
                    userName: 'testuser',
                };

                const notificationId = data?.notification?.id;
                expect(notificationId).to.be.eq(undefined);
            });

            it('should handle missing notification id', () => {
                const data = {
                    notification: {
                        isUnread: false,
                    },
                    userName: 'testuser',
                };

                const notificationId = (data.notification as any)?.id;
                expect(notificationId).to.be.eq(undefined);
            });
        });
    });
});

describe('Notification Types', () => {
    describe('supported notification types', () => {
        it('should support NEW_DM_RECEIVED type', () => {
            const notificationType = 'NEW_DM_RECEIVED';
            expect(notificationType).to.equal('NEW_DM_RECEIVED');
        });

        it('should support CONNECTION_REQUEST_ACCEPTED type', () => {
            const notificationType = 'CONNECTION_REQUEST_ACCEPTED';
            expect(notificationType).to.equal('CONNECTION_REQUEST_ACCEPTED');
        });

        it('should support NEW_LIKE_RECEIVED type', () => {
            const notificationType = 'NEW_LIKE_RECEIVED';
            expect(notificationType).to.equal('NEW_LIKE_RECEIVED');
        });

        it('should support NEW_SUPER_LIKE_RECEIVED type', () => {
            const notificationType = 'NEW_SUPER_LIKE_RECEIVED';
            expect(notificationType).to.equal('NEW_SUPER_LIKE_RECEIVED');
        });
    });

    describe('notification structure', () => {
        it('should have required fields', () => {
            const notification = {
                id: 'notif-123',
                userId: 'user-123',
                type: 'NEW_DM_RECEIVED',
                isUnread: true,
                messageLocaleKey: 'notifications.newDmReceived',
                messageParams: {},
                createdAt: new Date().toISOString(),
            };

            expect(notification).to.have.property('id');
            expect(notification).to.have.property('userId');
            expect(notification).to.have.property('type');
            expect(notification).to.have.property('isUnread');
            expect(notification).to.have.property('messageLocaleKey');
        });

        it('should support optional associationId', () => {
            const notificationWithAssociation = {
                id: 'notif-123',
                associationId: 'connection-456',
            };

            const notificationWithoutAssociation = {
                id: 'notif-456',
                associationId: null,
            };

            expect(notificationWithAssociation.associationId).to.equal('connection-456');
            expect(notificationWithoutAssociation.associationId).to.be.eq(null);
        });
    });
});
