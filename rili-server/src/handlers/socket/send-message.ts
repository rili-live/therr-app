import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs'; // tslint:disable-line no-implicit-dependencies
import { SocketServerActionTypes, SocketClientActionTypes } from 'rili-public-library/utilities/constants';
import * as Constants from '../../constants';
import { shouldIncludeLogs, shouldIncludeSocketLogs } from '../../server-socket-io';

const sendMessage = (socket: socketio.Socket, data: any) => {
    printLogs(shouldIncludeLogs, SocketClientActionTypes.SEND_MESSAGE, null, data);
    socket.emit('action', {
        type: SocketServerActionTypes.SEND_MESSAGE,
        data: `You: ${data.message}`,
        roomId: data.roomId,
    });
    socket.broadcast.to(data.roomName).emit(Constants.ACTION, {
        type: SocketServerActionTypes.SEND_MESSAGE,
        data: `${data.userName}: ${data.message}`,
        roomId: data.roomId,
    });
    printLogs(shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `${data.userName} said: ${data.message}`);
};

export default sendMessage;
