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
    database: process.env.USERS_SERVICE_DATABASE,
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
    database: process.env.USERS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE),
    max: 20, // set pool max size to 20
    idleTimeoutMillis: 10000, // close idle clients after 10 second
    connectionTimeoutMillis: 5000, // return an error after 5 second if connection could not be established
    // maxUses: 7500, // close (and replace) a connection after it has been used 7500 times (see below for discussion)
});

read.on('error', (err, client) => {
    printLogs({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        tracer: beeline,
        traceArgs: {
            dbHost: process.env.DB_HOST_MAIN_READ,
            dbName: process.env.USERS_SERVICE_DATABASE,
            processId: process.pid,
            isUncaughtException: true,
            errorMessage: err?.message,
            errorOrigin: 'connection',
            source: 'users-service',
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
            dbName: process.env.USERS_SERVICE_DATABASE,
            processId: process.pid,
            isUncaughtException: true,
            errorMessage: err?.message,
            errorOrigin: 'connection',
            source: 'users-service',
            hasDBConnectionError: true,
        },
    });
});

export default {
    read,
    write,
};
