import jwt from 'jsonwebtoken';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';

// Buffer (in seconds) before token expiry to trigger a fresh verify
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

export default (socket, { skipCache = false } = {}) => new Promise((resolve) => {
    if (!socket.handshake || !socket.handshake.query || !socket.handshake.query.token) {
        resolve(false);
        return;
    }

    // Return cached decoded token if still valid
    if (!skipCache && socket.data?.decodedToken) {
        const { exp } = socket.data.decodedToken;
        const nowInSeconds = Math.floor(Date.now() / 1000);

        if (exp && (exp - nowInSeconds) > TOKEN_EXPIRY_BUFFER_SECONDS) {
            resolve(socket.data.decodedToken);
            return;
        }
    }

    jwt.verify(socket.handshake.query.token, (process.env.JWT_SECRET || ''), (err, decoded) => {
        if (err) {
            // Clear cached token on verification failure
            if (socket.data) {
                socket.data.decodedToken = undefined;
            }

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
                    message: 'Unable to authenticate websocket request',
                },
            });
            return resolve(false);
        }

        // Cache the decoded token on the socket for subsequent actions
        if (socket.data) {
            socket.data.decodedToken = decoded;
        }

        return resolve(decoded);
    });
});
