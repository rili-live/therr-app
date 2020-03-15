import * as moment from 'moment';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs'; // eslint-disable-line no-implicit-dependencies
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants';
import * as Constants from '../../constants';
import { rsAppName, shouldPrintRedisLogs, shouldPrintSocketLogs } from '../../server-socket-io';

interface ILoginData {
    idToken: string;
    userName: string;
}

const login = (socket: socketio.Socket, redisSession: any, data: ILoginData) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');

    if (socket.handshake && socket.handshake.headers && socket.handshake.headers.host) {
        redisSession.create({
            app: rsAppName,
            socketId: socket.id,
            ip: socket.handshake.headers.host.split(':')[0],
            // 30 minutes
            ttl: 60 * 1000 * 30,
            data: {
                idToken: data.idToken,
                userName: data.userName,
            },
        }).then((response: any) => {
            socket.emit(Constants.ACTION, {
                type: SocketServerActionTypes.SESSION_CREATED_MESSAGE,
                data: response,
            });
        }).catch((err: any) => {
            printLogs({
                shouldPrintLogs: shouldPrintRedisLogs,
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err.toString(),
            });
        });
    }

    printLogs({
        shouldPrintLogs: shouldPrintSocketLogs,
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, has logged in.`,
    });

    // Emits an event back to the client who logged in
    socket.emit(Constants.ACTION, {
        type: SocketServerActionTypes.USER_LOGIN_SUCCESS,
        data: {
            message: {
                key: Date.now().toString(),
                time: now,
                text: `You have been logged in successfully.`,
            },
            userName: data.userName,
        },
    });
};

export default login;
