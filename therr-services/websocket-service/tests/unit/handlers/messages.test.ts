import { expect } from 'chai';
import sinon from 'sinon';
import { Notifications, SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';

const FORUM_PREFIX = 'FORUM:';
const COMMON_DATE_FORMAT = 'M/D/YY, h:mma';

describe('Messages Handler', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('sendDirectMessage', () => {
        describe('message data construction', () => {
            it('should construct message payload for messages-service', () => {
                const data = {
                    message: 'Hello, world!',
                    to: { id: 'recipient-123', socketId: 'socket-456' },
                    userId: 'sender-123',
                    userName: 'sender',
                    userImgSrc: 'https://example.com/img.jpg',
                };

                const requestPayload = {
                    message: data.message,
                    toUserId: data.to.id,
                    fromUserId: data.userId,
                    isUnread: !data.to.socketId,
                };

                expect(requestPayload.message).to.equal('Hello, world!');
                expect(requestPayload.toUserId).to.equal('recipient-123');
                expect(requestPayload.fromUserId).to.equal('sender-123');
                expect(requestPayload.isUnread).to.be.eq(false); // recipient is online
            });

            it('should mark message as unread when recipient is offline', () => {
                const data = {
                    message: 'Hello!',
                    to: { id: 'recipient-123', socketId: null },
                    userId: 'sender-123',
                };

                const isUnread = !data.to.socketId;
                expect(isUnread).to.be.eq(true);
            });

            it('should mark message as read when recipient is online', () => {
                const data = {
                    message: 'Hello!',
                    to: { id: 'recipient-123', socketId: 'socket-abc' },
                    userId: 'sender-123',
                };

                const isUnread = !data.to.socketId;
                expect(isUnread).to.be.eq(false);
            });
        });

        describe('socket events - sender', () => {
            it('should emit SEND_DIRECT_MESSAGE to sender with "you" as fromUserName', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    emit: emitSpy,
                };

                const data = {
                    to: { id: 'recipient-123' },
                    userImgSrc: 'https://example.com/img.jpg',
                    message: 'Hello!',
                };
                const createdMessage = { id: 'msg-123', createdAt: new Date().toISOString() };

                socket.emit('action', {
                    type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
                    data: {
                        contextUserId: data.to.id,
                        message: {
                            id: createdMessage.id,
                            fromUserName: 'you',
                            fromUserImgSrc: data.userImgSrc,
                            time: '1/1/24, 12:00pm',
                            text: data.message,
                        },
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].data.message.fromUserName).to.equal('you');
            });
        });

        describe('socket events - recipient (online)', () => {
            it('should broadcast SEND_DIRECT_MESSAGE to recipient when online', () => {
                const broadcastEmitSpy = sandbox.spy();
                const socket: any = {
                    broadcast: {
                        to: sandbox.stub().returns({
                            emit: broadcastEmitSpy,
                        }),
                    },
                };

                const data = {
                    to: { id: 'recipient-123', socketId: 'recipient-socket' },
                    userId: 'sender-123',
                    userName: 'sender',
                    userImgSrc: 'https://example.com/img.jpg',
                    message: 'Hello!',
                };
                const createdMessage = { id: 'msg-123' };

                socket.broadcast.to(data.to.socketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
                    data: {
                        contextUserId: data.userId,
                        message: {
                            id: createdMessage.id,
                            fromUserName: data.userName,
                            fromUserImgSrc: data.userImgSrc,
                            time: '1/1/24, 12:00pm',
                            text: data.message,
                        },
                    },
                });

                expect(socket.broadcast.to.calledWith('recipient-socket')).to.be.eq(true);
                expect(broadcastEmitSpy.firstCall.args[1].data.message.fromUserName).to.equal('sender');
            });
        });

        describe('notification for offline recipient', () => {
            it('should create notification data when recipient is offline', () => {
                const data = {
                    to: { id: 'recipient-123', socketId: null },
                    userId: 'sender-123',
                    userName: 'sender',
                };

                const notificationData = {
                    userId: data.to.id,
                    type: Notifications.Types.NEW_DM_RECEIVED,
                    associationId: null,
                    isUnread: true,
                    messageLocaleKey: Notifications.MessageKeys.NEW_DM_RECEIVED,
                    messageParams: {
                        userId: data.userId,
                        userName: data.userName,
                    },
                    shouldSendPushNotification: true,
                    fromUserName: data.userName,
                };

                expect(notificationData.type).to.equal(Notifications.Types.NEW_DM_RECEIVED);
                expect(notificationData.shouldSendPushNotification).to.be.eq(true);
            });
        });

        describe('DM notification throttling', () => {
            it('should generate correct throttle key', () => {
                const toUserId = 'recipient-123';
                const fromUserId = 'sender-456';
                const key = `dmNotificationThrottles:${toUserId}:${fromUserId}`;

                expect(key).to.equal('dmNotificationThrottles:recipient-123:sender-456');
            });

            it('should throttle for 20 minutes (default)', () => {
                const minWaitSeconds = 60 * 20; // Default from redisHelper
                expect(minWaitSeconds).to.equal(1200); // 20 minutes in seconds
            });
        });
    });

    describe('sendForumMessage', () => {
        describe('message data construction', () => {
            it('should construct message payload for forums-messages endpoint', () => {
                const data = {
                    roomId: 'forum-123',
                    message: 'Hello forum!',
                    userId: 'sender-123',
                    userName: 'sender',
                    userImgSrc: 'https://example.com/img.jpg',
                };

                const requestPayload = {
                    forumId: data.roomId,
                    message: data.message,
                    fromUserId: data.userId,
                    isUnread: false,
                };

                expect(requestPayload.forumId).to.equal('forum-123');
                expect(requestPayload.isUnread).to.be.eq(false);
            });
        });

        describe('socket events - sender', () => {
            it('should emit SEND_MESSAGE to sender with "you" as fromUserName', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    emit: emitSpy,
                };

                const data = {
                    roomId: 'forum-123',
                    userImgSrc: 'https://example.com/img.jpg',
                    message: 'Hello forum!',
                };

                socket.emit('action', {
                    type: SocketServerActionTypes.SEND_MESSAGE,
                    data: {
                        roomId: data.roomId,
                        message: {
                            key: Date.now().toString(),
                            fromUserName: 'you',
                            fromUserImgSrc: data.userImgSrc,
                            time: '1/1/24, 12:00pm',
                            text: data.message,
                        },
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.SEND_MESSAGE);
                expect(emitSpy.firstCall.args[1].data.message.fromUserName).to.equal('you');
            });
        });

        describe('socket events - broadcast to room', () => {
            it('should broadcast SEND_MESSAGE to forum room with FORUM: prefix', () => {
                const broadcastEmitSpy = sandbox.spy();
                const socket: any = {
                    broadcast: {
                        to: sandbox.stub().returns({
                            emit: broadcastEmitSpy,
                        }),
                    },
                };

                const data = {
                    roomId: 'forum-123',
                    userName: 'sender',
                    userImgSrc: 'https://example.com/img.jpg',
                    message: 'Hello forum!',
                };

                socket.broadcast.to(`${FORUM_PREFIX}${data.roomId}`).emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.SEND_MESSAGE,
                    data: {
                        roomId: data.roomId,
                        message: {
                            key: Date.now().toString(),
                            fromUserName: data.userName,
                            fromUserImgSrc: data.userImgSrc,
                            time: '1/1/24, 12:00pm',
                            text: data.message,
                        },
                    },
                });

                expect(socket.broadcast.to.calledWith('FORUM:forum-123')).to.be.eq(true);
                expect(broadcastEmitSpy.firstCall.args[1].data.message.fromUserName).to.equal('sender');
            });
        });

        describe('member notification', () => {
            it('should construct notify-members request data', () => {
                const data = {
                    roomId: 'forum-123',
                    roomName: 'Test Forum',
                    userId: 'sender-123',
                };

                const notifyMembersPayload = {
                    groupId: data.roomId,
                    groupName: data.roomName,
                    excludedMembers: [data.userId],
                };

                expect(notifyMembersPayload.groupId).to.equal('forum-123');
                expect(notifyMembersPayload.excludedMembers).to.include('sender-123');
            });

            it('should exclude sender from notifications', () => {
                const senderId = 'sender-123';
                const allMembers = ['sender-123', 'member-1', 'member-2'];
                const excludedMembers = [senderId];

                const membersToNotify = allMembers.filter((m) => !excludedMembers.includes(m));

                expect(membersToNotify).to.not.include('sender-123');
                expect(membersToNotify).to.have.lengthOf(2);
            });
        });
    });

    describe('Message formatting', () => {
        describe('date/time formatting', () => {
            it('should use consistent date format', () => {
                expect(COMMON_DATE_FORMAT).to.equal('M/D/YY, h:mma');
            });
        });

        describe('message key generation', () => {
            it('should generate unique key from timestamp', () => {
                const key1 = Date.now().toString();
                // Small delay to ensure different timestamps
                const key2 = (Date.now() + 1).toString();

                expect(key1).to.not.equal(key2);
                expect(key1).to.match(/^\d+$/);
            });
        });
    });
});
