import io from 'socket.io-client';
import createSocketIoMiddleware from 'redux-socket.io';
import {
    SOCKET_MIDDLEWARE_ACTION,
    SocketClientActionTypes,
    WEB_CLIENT_PREFIX,
} from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from './config/brandConfig';
import getConfig from './utilities/getConfig';

// TODO: When failing to connect through socket.io, we should have a middle layer to fallback to polling or direct rest requests
// Websocket Service, Socket IO, Redis should not be single points of failure

// Socket IO Connection
// NOTE: For local dev development, must use machine IP rather than localhost
// When device is plugged into computer, device seems to work just fine
export const socketIO = io(`${getConfig().baseSocketUrl}`, {
    autoConnect: false,
    secure: true,
    transports: ['websocket'],
    upgrade: false,
    path: `${getConfig().socket.clientPath}`,
    rejectUnauthorized: false,
});

if (__DEV__) {
    socketIO.on('error', (error) => {
        console.log('socket.io error', error);
    });

    socketIO.on('connect_error', (error) => {
        console.log('socket.io connect_error', error);
    });

    socketIO.on('reconnect', (error) => {
        console.log('socket.io reconnect', error);
    });

    socketIO.on('reconnect_attempt', (error) => {
        console.log('socket.io reconnect_attempt', error);
    });

    socketIO.on('reconnecting', (error) => {
        console.log('socket.io reconnecting', error);
    });

    socketIO.on('reconnect_error', (error) => {
        console.log('socket.io reconnect_error', error);
    });

    socketIO.on('reconnect_failed', (error) => {
        console.log('socket.io reconnect_failed', error);
    });
}

export const updateSocketToken = (user, shouldConnect?: boolean) => {
    if (user && user.details && user.details.idToken) {
        socketIO.io.opts.query = {
            userId: user.details.id,
            userName: user.details.userName,
            locale: user.settings.locale,
            token: user.details.idToken,
            platform: 'mobile',
            brandVariation: CURRENT_BRAND_VARIATION,
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
