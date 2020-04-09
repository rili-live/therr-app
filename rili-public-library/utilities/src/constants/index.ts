import LogLevelMap, { ILogLevel } from './LogLevelMap';

// Enums
import * as Notifications from './enums/Notifications';
import SocketClientActionTypes from './enums/SocketClientActionTypes';
import SocketServerActionTypes from './enums/SocketServerActionTypes';

// If you change these string values, be sure to update the relative enums
// Enumers cannot be build from string concatenation so much be input manually
export const SERVER_PREFIX = 'SERVER';
export const WEB_CLIENT_PREFIX = 'CLIENT';

export {
    ILogLevel,
    LogLevelMap,
    Notifications,
    SocketClientActionTypes,
    SocketServerActionTypes,
};
