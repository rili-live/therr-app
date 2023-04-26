import { Pool } from 'pg';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline'; // eslint-disable-line import/order

export interface IConnection {
    read: Pool;
    write: Pool;
}

const read: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_READ,
    user: process.env.DB_USER_MAIN_READ,
    password: process.env.DB_PASSWORD_MAIN_READ,
    database: process.env.MESSAGES_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_READ),
});

const write: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: process.env.MESSAGES_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE),
});

read.on('error', (err, client) => {
    printLogs({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        tracer: beeline,
        traceArgs: {
            dbHost: process.env.DB_HOST_MAIN_READ,
            dbName: process.env.MESSAGES_SERVICE_DATABASE,
            processId: process.pid,
            isUncaughtException: true,
            errorMessage: err?.message,
            errorOrigin: 'connection',
            source: 'messages-service',
            hasDBConnectionError: true,
        },
    });
});

write.on('error', (err, client) => {
    printLogs({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        tracer: beeline,
        traceArgs: {
            dbHost: process.env.DB_HOST_MAIN_READ,
            dbName: process.env.MESSAGES_SERVICE_DATABASE,
            processId: process.pid,
            isUncaughtException: true,
            errorMessage: err?.message,
            errorOrigin: 'connection',
            source: 'messages-service',
            hasDBConnectionError: true,
        },
    });
});

export default {
    read,
    write,
};
