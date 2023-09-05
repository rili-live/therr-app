import { Pool } from 'pg';
import logSpan from 'therr-js-utilities/log-or-update-span';

export interface IConnection {
    read: Pool;
    write: Pool;
}

const read: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_READ,
    user: process.env.DB_USER_MAIN_READ,
    password: process.env.DB_PASSWORD_MAIN_READ,
    database: process.env.MAPS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_READ),
    max: 20, // set pool max size to 20
    idleTimeoutMillis: 10000, // close idle clients after 10 second
    connectionTimeoutMillis: 5000, // return an error after 5 second if connection could not be established
    // maxUses: 7500, // close (and replace) a connection after it has been used 7500 times (see below for discussion)
});

const write: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: process.env.MAPS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE),
    max: 20, // set pool max size to 20
    idleTimeoutMillis: 10000, // close idle clients after 10 second
    connectionTimeoutMillis: 5000, // return an error after 5 second if connection could not be established
    // maxUses: 7500, // close (and replace) a connection after it has been used 7500 times (see below for discussion)
});

read.on('error', (err, client) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        traceArgs: {
            'db.host': process.env.DB_HOST_MAIN_READ,
            'db.name': process.env.MAPS_SERVICE_DATABASE,
            'process.id': process.pid,
            'error.isUncaughtException': true,
            'error.message': err?.message,
            'error.origin': 'connection',
            source: 'maps-service',
            'error.hasDBConnectionError': true,
        },
    });
});

write.on('error', (err, client) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        traceArgs: {
            'db.host': process.env.DB_HOST_MAIN_READ,
            'db.name': process.env.MAPS_SERVICE_DATABASE,
            'process.id': process.pid,
            'error.isUncaughtException': true,
            'error.message': err?.message,
            'error.origin': 'connection',
            source: 'maps-service',
            'db.hasDBConnectionError': true,
        },
    });
});

export default {
    read,
    write,
};
