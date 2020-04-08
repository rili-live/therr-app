import axios from 'axios';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';
import * as Constants from '../constants';
import globalConfig from '../../../../global-config.js';

interface IUpdateUserConnectionData {
    connection: any;
    userName: string;
}

const updateUserConnection = (socket: socketio.Socket, data: IUpdateUserConnectionData) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, updated a userConnection`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
        },
    });
    axios({
        method: 'put',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseApiRoute}/users/connections/${data.connection.requestingUserId}`,
        data: data.connection,
    }).then((response) => {
        // TODO: RSERV-26 - Should emit to sending and receiving user sockets
        socket.emit(Constants.ACTION, {
            type: SocketServerActionTypes.CONNECTION_UPDATED,
            data: response.data,
        });
    });
};

export default updateUserConnection;
