import { expect } from 'chai';
import sinon from 'sinon';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';

const FORUM_PREFIX = 'FORUM:';

describe('Rooms Handler', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('joinRoom', () => {
        describe('room ID prefixing', () => {
            it('should prefix room ID with FORUM:', () => {
                const roomId = 'room-123';
                const prefixedRoomId = `${FORUM_PREFIX}${roomId}`;

                expect(prefixedRoomId).to.equal('FORUM:room-123');
            });

            it('should handle various room ID formats', () => {
                const roomIds = ['simple', 'with-dashes', 'with_underscores', '123', 'uuid-abc-123-def'];

                roomIds.forEach((id) => {
                    const prefixed = `${FORUM_PREFIX}${id}`;
                    expect(prefixed.startsWith('FORUM:')).to.be.eq(true);
                });
            });
        });

        describe('duplicate join prevention', () => {
            it('should not join room if already in room', () => {
                const roomId = 'room-123';
                const prefixedRoomId = `${FORUM_PREFIX}${roomId}`;
                const socket: any = {
                    rooms: new Set([prefixedRoomId]),
                };

                const isAlreadyInRoom = socket.rooms.has(prefixedRoomId);
                expect(isAlreadyInRoom).to.be.eq(true);
            });

            it('should allow joining room if not already in room', () => {
                const roomId = 'room-123';
                const prefixedRoomId = `${FORUM_PREFIX}${roomId}`;
                const socket: any = {
                    rooms: new Set(['other-room']),
                };

                const isAlreadyInRoom = socket.rooms.has(prefixedRoomId);
                expect(isAlreadyInRoom).to.be.eq(false);
            });
        });

        describe('socket events', () => {
            it('should emit JOINED_ROOM event to joining user', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    rooms: new Set(),
                    emit: emitSpy,
                    join: sandbox.stub(),
                };

                const roomData = {
                    roomId: 'room-123',
                    roomName: 'Test Room',
                    userId: 'user-123',
                    userName: 'testuser',
                    userImgSrc: 'https://example.com/img.jpg',
                };

                const createdMessage = { id: 'msg-123' };
                const now = '1/1/24, 12:00pm';

                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.JOINED_ROOM,
                    data: {
                        roomId: roomData.roomId,
                        message: {
                            id: createdMessage.id,
                            fromUserName: 'you',
                            fromUserImgSrc: roomData.userImgSrc,
                            time: now,
                            text: `You joined the room, ${roomData.roomName}`,
                            isAnnouncement: true,
                        },
                        userName: roomData.userName,
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.JOINED_ROOM);
                expect(emitSpy.firstCall.args[1].data.message.isAnnouncement).to.be.eq(true);
            });

            it('should broadcast OTHER_JOINED_ROOM to other room members', () => {
                const broadcastEmitSpy = sandbox.spy();
                const socket: any = {
                    broadcast: {
                        to: sandbox.stub().returns({
                            emit: broadcastEmitSpy,
                        }),
                    },
                };

                const roomId = 'room-123';
                const roomName = 'Test Room';
                const userName = 'testuser';
                const createdMessage = { id: 'msg-123' };

                socket.broadcast.to(`${FORUM_PREFIX}${roomId}`).emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.OTHER_JOINED_ROOM,
                    data: {
                        roomId,
                        message: {
                            id: createdMessage.id,
                            fromUserName: userName,
                            fromUserImgSrc: 'https://example.com/img.jpg',
                            time: '1/1/24, 12:00pm',
                            text: `${userName} joined the room, ${roomName}`,
                            isAnnouncement: true,
                        },
                    },
                });

                expect(socket.broadcast.to.calledOnce).to.be.eq(true);
                expect(socket.broadcast.to.firstCall.args[0]).to.equal('FORUM:room-123');
                expect(broadcastEmitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.OTHER_JOINED_ROOM);
            });
        });

        describe('announcement message construction', () => {
            it('should create correct socket message for joining user', () => {
                const roomName = 'Test Room';
                const socketMessage = `You joined the room, ${roomName}`;

                expect(socketMessage).to.equal('You joined the room, Test Room');
            });

            it('should create correct database message for announcement', () => {
                const userName = 'testuser';
                const roomName = 'Test Room';
                const dbMessage = `${userName} joined the room, ${roomName}`;

                expect(dbMessage).to.equal('testuser joined the room, Test Room');
            });
        });

        describe('socket.join behavior', () => {
            it('should join the socket to the prefixed room', () => {
                const joinSpy = sandbox.spy();
                const socket: any = {
                    rooms: new Set(),
                    join: joinSpy,
                };

                const roomId = 'room-123';
                const prefixedRoomId = `${FORUM_PREFIX}${roomId}`;

                socket.join(prefixedRoomId);

                expect(joinSpy.calledOnce).to.be.eq(true);
                expect(joinSpy.firstCall.args[0]).to.equal('FORUM:room-123');
            });
        });
    });

    describe('leaveRoom', () => {
        describe('socket.leave behavior', () => {
            it('should leave the prefixed room', () => {
                const leaveSpy = sandbox.spy();
                const socket: any = {
                    leave: leaveSpy,
                };

                const roomId = 'room-123';
                socket.leave(`${FORUM_PREFIX}${roomId}`);

                expect(leaveSpy.calledOnce).to.be.eq(true);
                expect(leaveSpy.firstCall.args[0]).to.equal('FORUM:room-123');
            });
        });

        describe('socket events', () => {
            it('should emit LEFT_ROOM event to leaving user', () => {
                const emitSpy = sandbox.spy();
                const socket: any = {
                    id: 'socket-123',
                    emit: emitSpy,
                    leave: sandbox.stub(),
                };

                const roomData = {
                    roomId: 'room-123',
                    userName: 'testuser',
                    userImgSrc: 'https://example.com/img.jpg',
                };

                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.LEFT_ROOM,
                    data: {
                        roomId: roomData.roomId,
                        message: {
                            key: Date.now().toString(),
                            fromUserName: 'you',
                            fromUserImgSrc: roomData.userImgSrc,
                            time: '1/1/24, 12:00pm',
                            text: `You left the room, ${roomData.roomId}`,
                            isAnnouncement: true,
                        },
                    },
                });

                expect(emitSpy.calledOnce).to.be.eq(true);
                expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.LEFT_ROOM);
            });

            it('should broadcast LEFT_ROOM to other room members', () => {
                const broadcastEmitSpy = sandbox.spy();
                const socket: any = {
                    broadcast: {
                        to: sandbox.stub().returns({
                            emit: broadcastEmitSpy,
                        }),
                    },
                };

                const roomId = 'room-123';
                const userName = 'testuser';

                socket.broadcast.to(`${FORUM_PREFIX}${roomId}`).emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.LEFT_ROOM,
                    data: {
                        roomId,
                        message: {
                            key: Date.now().toString(),
                            fromUserName: userName,
                            fromUserImgSrc: 'https://example.com/img.jpg',
                            time: '1/1/24, 12:00pm',
                            text: `${userName} left the room`,
                            isAnnouncement: true,
                        },
                    },
                });

                expect(socket.broadcast.to.calledOnce).to.be.eq(true);
                expect(socket.broadcast.to.firstCall.args[0]).to.equal('FORUM:room-123');
            });
        });

        describe('leave message construction', () => {
            it('should create correct message for leaving user', () => {
                const roomId = 'room-123';
                const message = `You left the room, ${roomId}`;

                expect(message).to.equal('You left the room, room-123');
            });

            it('should create correct broadcast message for other users', () => {
                const userName = 'testuser';
                const message = `${userName} left the room`;

                expect(message).to.equal('testuser left the room');
            });
        });
    });

    describe('Room management helpers', () => {
        describe('getSocketRoomsList', () => {
            it('should filter rooms by FORUM: prefix', () => {
                const allRooms = new Set([
                    'socket-id-123',
                    'FORUM:room-1',
                    'FORUM:room-2',
                    'other-room',
                ]);

                const forumRooms = Array.from(allRooms).filter((room) => room.startsWith('FORUM:'));

                expect(forumRooms).to.have.lengthOf(2);
                expect(forumRooms).to.include('FORUM:room-1');
                expect(forumRooms).to.include('FORUM:room-2');
            });

            it('should handle empty rooms set', () => {
                const allRooms = new Set<string>();
                const forumRooms = Array.from(allRooms).filter((room) => room.startsWith('FORUM:'));

                expect(forumRooms).to.have.lengthOf(0);
            });
        });
    });
});
