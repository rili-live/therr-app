import * as socketio from 'socket.io';

const getRoomsList = (rooms: socketio.Rooms) => {
    const roomsArray: any[] = [];

    const roomKeys: any = Object.keys(rooms).filter((roomKey: string) => {
        return rooms[roomKey].length !== 1 || roomKey !== Object.keys(rooms[roomKey].sockets)[0];
    });

    roomKeys.forEach((roomKey: string) => roomsArray.push({
        roomKey,
        length: rooms[roomKey].length,
        sockets: Object.keys(rooms[roomKey].sockets).map((socketId: any) => ({
            socketId,
            active: rooms[roomKey].sockets[socketId],
        }))
    }));

    return roomsArray;
};

export default getRoomsList;
