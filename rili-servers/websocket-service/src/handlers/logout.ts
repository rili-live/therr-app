import moment from 'moment';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
import * as Constants from '../constants';
import beeline from '../beeline';
import { ILoginData } from './login';
import redisSessions from '../store/redisSessions';

interface ILogoutArgs {
    socket: socketio.Socket;
    data: ILoginData;
}

const logout = ({
    socket,
    data,
}: ILogoutArgs) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');

    if (socket.handshake && socket.handshake.headers && socket.handshake.headers.host) {
        redisSessions.remove(socket.id).then((response: any) => {
            socket.emit(Constants.ACTION, {
                type: SocketServerActionTypes.SESSION_CLOSED_MESSAGE,
                data: {},
            });
        }).catch((err: any) => {
            printLogs({
                level: 'verbose',
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err.toString(),
                tracer: beeline,
                traceArgs: {
                    ip: socket.handshake.headers.host.split(':')[0],
                    socketId: socket.id,
                    userName: data.userName,
                },
            });
        });
    }

    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, has LOGGED OUT.`,
        tracer: beeline,
        traceArgs: {
            ip: socket.handshake.headers.host.split(':')[0],
            socketId: socket.id,
            userName: data.userName,
        },
    });

    // Emits an event back to the client who logged OUT
    socket.emit(Constants.ACTION, {
        type: SocketServerActionTypes.USER_LOGOUT_SUCCESS,
        data: {
            message: {
                key: Date.now().toString(),
                time: now,
                text: 'You have been logged in successfully.',
            },
            userName: data.userName,
        },
    });
};

export default logout;
