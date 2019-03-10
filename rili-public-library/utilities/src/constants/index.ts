import SocketClientActionTypes from './enums/socket-client-action-types';
import SocketServerActionTypes from './enums/socket-server-action-types';

// If you change these string values, be sure to update the relative enums
// Enumers cannot be build from string concatenation so much be input manually
export const SERVER_PREFIX = 'SERVER';
export const WEB_CLIENT_PREFIX = 'CLIENT';

export {
    SocketClientActionTypes,
    SocketServerActionTypes,
};
