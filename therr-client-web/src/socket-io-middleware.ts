import io from 'socket.io-client';
import createSocketIoMiddleware from 'redux-socket.io';
import { SOCKET_MIDDLEWARE_ACTION, SocketClientActionTypes, WEB_CLIENT_PREFIX } from 'therr-js-utilities/constants';
import * as globalConfig from '../../global-config';

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

// Socket IO Connection
export const socketIO = io(`${envVars.baseSocketUrl}`, {
    autoConnect: false,
    secure: true,
    transports: ['websocket'],
    upgrade: false,
    path: envVars.socket.clientPath,
    // rejectUnauthorized: false,
});

export const updateSocketToken = (user, shouldConnect?: boolean) => {
    if (user?.details?.idToken) {
        socketIO.io.opts.query = {
            token: user.details.idToken,
        };

        if (shouldConnect) {
            socketIO.connect();
            socketIO.emit(SOCKET_MIDDLEWARE_ACTION, {
                type: SocketClientActionTypes.UPDATE_SESSION,
                data: user,
            });
        }
    }
};

export default createSocketIoMiddleware(socketIO, `${WEB_CLIENT_PREFIX}:`, { eventName: SOCKET_MIDDLEWARE_ACTION });
