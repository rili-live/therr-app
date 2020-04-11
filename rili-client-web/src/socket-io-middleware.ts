import io from 'socket.io-client';
import createSocketIoMiddleware from 'redux-socket.io';
import { WEB_CLIENT_PREFIX } from 'rili-public-library/utilities/constants.js';
import * as globalConfig from '../../global-config.js';

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

// Socket IO Connection
export const socketIO = io(`${envVars.baseSocketUrl}`, {
    secure: true,
    transports: ['websocket'],
    upgrade: false,
    path: envVars.socket.clientPath,
    // rejectUnauthorized: false,
});

// TODO: Find a way to send server connection even after middleware instantiates
export default createSocketIoMiddleware(socketIO, `${WEB_CLIENT_PREFIX}:`);
