import jwt from 'jsonwebtoken';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';

export default (socket) => new Promise((resolve) => {
    if (!socket.handshake || !socket.handshake.query || !socket.handshake.query.token) {
        return resolve(false);
    }

    jwt.verify(socket.handshake.query.token, (process.env.JWT_SECRET || ''), (err, decoded) => {
        if (err) {
            printLogs({
                level: 'info',
                messageOrigin: 'SOCKET_AUTHENTICATION_ERROR',
                messages: err,
                tracer: beeline,
                traceArgs: {
                    socketId: socket.id,
                },
            });
            socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                type: SocketServerActionTypes.UNAUTHORIZED,
                data: {
                    message: 'Unable to autheticate websocket request',
                },
            });
            return resolve(false);
        }
        return resolve(decoded);
    });
});
