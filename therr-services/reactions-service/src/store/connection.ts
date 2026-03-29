import { Pool } from 'pg';
// eslint-disable-next-line import/extensions, import/no-unresolved
import logSpan from 'therr-js-utilities/log-or-update-span';

export interface IConnection {
    read: Pool;
    write: Pool;
}

const read: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_READ,
    user: process.env.DB_USER_MAIN_READ,
    password: process.env.DB_PASSWORD_MAIN_READ,
    database: process.env.REACTIONS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_READ),
    max: 12, // right-sized for cloud-sql-proxy limits (20 total across read+write)
    idleTimeoutMillis: 30000, // keep idle connections longer to reduce reconnect overhead
    connectionTimeoutMillis: 5000,
    maxUses: 7500, // recycle connections to prevent memory leaks from long-lived connections
    statement_timeout: 15000, // fail fast on slow queries (15s) to free pool connections
    idle_in_transaction_session_timeout: 30000, // kill idle-in-transaction sessions after 30s
} as any);

const write: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: process.env.REACTIONS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE),
    max: 5, // writes are less frequent; keep pool small to avoid proxy bottleneck
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500,
    statement_timeout: 15000,
    idle_in_transaction_session_timeout: 30000,
} as any);

read.on('error', (err, _client) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        traceArgs: {
            'db.host': process.env.DB_HOST_MAIN_READ,
            'db.name': process.env.REACTIONS_SERVICE_DATABASE,
            'process.id': process.pid,
            'error.isUncaughtException': true,
            'error.message': err?.message,
            'error.origin': 'connection',
            source: 'reactions-service',
            'db.hasDBConnectionError': true,
        },
    });
});

write.on('error', (err, _client) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        traceArgs: {
            'db.host': process.env.DB_HOST_MAIN_WRITE,
            'db.name': process.env.REACTIONS_SERVICE_DATABASE,
            'process.id': process.pid,
            'error.isUncaughtException': true,
            'error.message': err?.message,
            'error.origin': 'connection',
            source: 'reactions-service',
            'db.hasDBConnectionError': true,
        },
    });
});

// Graceful shutdown: drain pools on SIGTERM (k8s pod eviction)
let isShuttingDown = false;
const shutdownPools = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Draining database connection pools'],
        traceArgs: { source: 'reactions-service' },
    });
    Promise.all([read.end(), write.end()]).then(() => {
        process.exit(0);
    }).catch(() => {
        process.exit(1);
    });
};

process.on('SIGTERM', shutdownPools);

export default {
    read,
    write,
};
