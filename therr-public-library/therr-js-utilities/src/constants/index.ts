import Location from './Location';
import LogLevelMap, { ILogLevel } from './LogLevelMap';
import {
    DefaultUserResources,
    ResourceExchangeRates,
} from './Resources';

// Enums
import * as Notifications from './enums/Notifications';
import SocketClientActionTypes from './enums/SocketClientActionTypes';
import SocketServerActionTypes from './enums/SocketServerActionTypes';

// If you change these string values, be sure to update the relative enums
// Enumers cannot be build from string concatenation so much be input manually
export const SERVER_PREFIX = 'SERVER';
export const WEB_CLIENT_PREFIX = 'CLIENT';
export const SOCKET_MIDDLEWARE_ACTION = 'action';

export {
    Location,
    ILogLevel,
    LogLevelMap,
    Notifications,
    DefaultUserResources,
    ResourceExchangeRates,
    SocketClientActionTypes,
    SocketServerActionTypes,
};
