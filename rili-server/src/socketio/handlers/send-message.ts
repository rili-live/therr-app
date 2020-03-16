import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import moment from 'moment';
import { SocketServerActionTypes, SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import * as Constants from '../../constants';

const sendMessage = (socket: socketio.Socket, data: any) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `${SocketClientActionTypes.SEND_MESSAGE}: ${data.toString()}`,
    });
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');
    socket.emit('action', {
        type: SocketServerActionTypes.SEND_MESSAGE,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                time: now,
                text: `You: ${data.message}`,
            },
        },
    });
    socket.broadcast.to(data.roomId).emit(Constants.ACTION, {
        type: SocketServerActionTypes.SEND_MESSAGE,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                time: now,
                text: `${data.userName}: ${data.message}`,
            },
        },
    });
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `${data.userName} said: ${data.message}`,
    });
};

export default sendMessage;
