import { Server } from 'socket.io';
import { FORUM_PREFIX } from '../handlers/rooms';

const getSocketRoomsList = (io: Server, rooms: Set<any>) => {
    const roomPromises: Promise<any>[] = [];
    const forumRoomKeys: any[] = [...rooms].filter((id) => id.includes(FORUM_PREFIX));

    forumRoomKeys.forEach((roomKey) => {
        const promise = (io.in(roomKey) as any).allSockets()
            .then((socketIds) => ({
                roomKey,
                socketIds: [...socketIds],
            }));
        roomPromises.push(promise);
    });

    return Promise.all(roomPromises)
        .then((responses) => responses.map(({ roomKey, socketIds }) => ({
            roomKey: roomKey.replace(FORUM_PREFIX, ''),
            length: socketIds.length,
            sockets: socketIds.map((socketId: any) => ({
                socketId,
                active: true,
            })),
        })));
};

export default getSocketRoomsList;
