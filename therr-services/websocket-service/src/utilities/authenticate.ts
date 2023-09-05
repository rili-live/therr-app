import jwt from 'jsonwebtoken';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';

export default (socket) => new Promise((resolve) => {
    if (!socket.handshake || !socket.handshake.query || !socket.handshake.query.token) {
        resolve(false);
        return;
    }

    jwt.verify(socket.handshake.query.token, (process.env.JWT_SECRET || ''), (err, decoded) => {
        if (err) {
            logSpan({
                level: 'info',
                messageOrigin: 'SOCKET_AUTHENTICATION_ERROR',
                messages: err,
                traceArgs: {
                    'socket.id': socket.id,
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
