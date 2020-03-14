import * as io from 'socket.io-client';
import createSocketIoMiddleware from 'redux-socket.io';
import { WEB_CLIENT_PREFIX } from 'rili-public-library/utilities/constants';
import * as globalConfig from '../../global-config.js';

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

// Socket IO Connection
const socketIO = io(`${envVars.baseSocketUrl}`, {
    secure: true,
    transports: ['websocket'],
    upgrade: false,
    path: '/ws/socketio',
    // rejectUnauthorized: false,
});

// TODO: Find a was to send server connection evern after middleware instantiates
export default createSocketIoMiddleware(socketIO, `${WEB_CLIENT_PREFIX}:`);