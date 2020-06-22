import io from 'socket.io-client';
import createSocketIoMiddleware from 'redux-socket.io';
import {
    SOCKET_MIDDLEWARE_ACTION,
    SocketClientActionTypes,
    WEB_CLIENT_PREFIX,
} from 'rili-js-utilities/constants';
import getConfig from './utilities/getConfig';

// Socket IO Connection
export const socketIO = io(`${getConfig().baseSocketUrl}`, {
    autoConnect: false,
    secure: true,
    transports: ['websocket'],
    upgrade: false,
    path: getConfig().socket.clientPath,
    // rejectUnauthorized: false,
});

export const updateSocketToken = (user, shouldConnect?: boolean) => {
    if (user && user.details && user.details.idToken) {
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

export default createSocketIoMiddleware(socketIO, `${WEB_CLIENT_PREFIX}:`, {
    eventName: SOCKET_MIDDLEWARE_ACTION,
});
