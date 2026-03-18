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
    max: 20,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500, // recycle connections to prevent memory leaks from long-lived connections
    statement_timeout: 30000, // kill queries running longer than 30s to prevent runaway geo queries
    idle_in_transaction_session_timeout: 60000, // kill idle-in-transaction sessions after 60s
} as any);

const write: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: process.env.MAPS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE),
    max: 10, // write pool needs fewer connections than read
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500,
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 60000,
} as any);

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
