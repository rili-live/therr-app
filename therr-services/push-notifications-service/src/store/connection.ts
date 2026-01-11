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
});

const write: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: process.env.MAPS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE),
});

read.on('error', (err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        traceArgs: {
            'db.host': process.env.DB_HOST_MAIN_READ,
            'db.name': 'PUSH-NOTIFICATIONS-NO-DB',
            'process.id': process.pid,
            'error.isUncaughtException': true,
            'error.message': err?.message,
            'error.origin': 'connection',
            source: 'push-notifications-service',
            'db.hasDBConnectionError': true,
        },
    });
});

write.on('error', (err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        traceArgs: {
            'db.host': process.env.DB_HOST_MAIN_READ,
            'db.name': 'PUSH-NOTIFICATIONS-NO-DB',
            'process.id': process.pid,
            'error.isUncaughtException': true,
            'error.message': err?.message,
            'error.origin': 'connection',
            source: 'push-notifications-service',
            'db.hasDBConnectionError': true,
        },
    });
});

export default {
    read,
    write,
};
