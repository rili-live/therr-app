import Content from './Content';
import ErrorCodes from './ErrorCodes';
import Location from './Location';
import LogLevelMap, { ILogLevel } from './LogLevelMap';
import {
    DefaultUserResources,
    ResourceExchangeRates,
} from './Resources';

// Enums
import AccessLevels from './enums/AccessLevels';
import * as Notifications from './enums/Notifications';
import SocketClientActionTypes from './enums/SocketClientActionTypes';
import SocketServerActionTypes from './enums/SocketServerActionTypes';

const PasswordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;

// If you change these string values, be sure to update the relative enums
// Enumers cannot be build from string concatenation so much be input manually
export const SERVER_PREFIX = 'SERVER';
export const WEB_CLIENT_PREFIX = 'CLIENT';
export const SOCKET_MIDDLEWARE_ACTION = 'action';

export {
    AccessLevels,
    Content,
    ErrorCodes,
    Location,
    ILogLevel,
    LogLevelMap,
    Notifications,
    PasswordRegex,
    DefaultUserResources,
    ResourceExchangeRates,
    SocketClientActionTypes,
    SocketServerActionTypes,
};
