import jwt from 'jsonwebtoken';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import beeline from '../beeline';
import * as Constants from '../constants/index';

export default (socket, type) => new Promise((resolve) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_AUTHENTICATION',
        messages: 'Socket authntication debug',
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
            socketHandshake: JSON.stringify(socket.handshake),
        },
    });
    if (!socket.handshake || !socket.handshake.query || !socket.handshake.query.token) {
        return resolve();
    }

    jwt.verify(socket.handshake.query.token, (process.env.SECRET || ''), (err, decoded) => {
        if (err) {
            printLogs({
                level: 'verbose',
                messageOrigin: 'SOCKET_AUTHENTICATION_ERROR',
                messages: err,
                tracer: beeline,
                traceArgs: {
                    socketId: socket.id,
                },
            });
            socket.emit(Constants.ACTION, {
                type: SocketServerActionTypes.UNAUTHORIZED,
                data: {
                    message: 'Unable to autheticate websocket request',
                },
            });
            return resolve();
        }
        return resolve(decoded);
    });
});
