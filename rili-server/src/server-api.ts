import * as cluster from 'cluster';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { argv } from 'yargs';
import * as Knex from 'knex';
import * as globalConfig from '../../global-config.js';
import printLogs from 'rili-public-library/utilities/print-logs';
import AuthRoutes from './api/routes/AuthRoutes';
import UserRoutes from './api/routes/UserRoutes';

export const shouldPrintAllLogs = argv.withAllLogs;
export const shouldPrintSQLLogs =  argv.withSQLLogs || shouldPrintAllLogs;
export const shouldPrintServerLogs = argv.withServerLogs || shouldPrintAllLogs;

import { version as packageVersion } from '../package.json';
const API_BASE_ROUTE = `/api/v${packageVersion.split('.')[0]}`;

const app = express();

// Parse JSON
app.use(bodyParser.json());

// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));

// Databse Connection
const dbConnectionConfig = {
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
};

const knex = Knex({
    client: 'pg',
    connection: dbConnectionConfig,
    pool: {
        min: 2,
        max: 10,
        log: true,
    },
    acquireConnectionTimeout: 60000,
});

// Configure routes
app.use(API_BASE_ROUTE, (new AuthRoutes(knex)).router);
app.use(API_BASE_ROUTE, (new UserRoutes(knex)).router);

// Cluster config and server start
if (cluster.isMaster && argv.shouldCluster) {
    const numWorkers = os.cpus().length;

    printLogs({
        shouldPrintLogs: shouldPrintServerLogs,
        messageOrigin: 'API_SERVER',
        messages: `Master cluster setting up ${numWorkers} workers...`,
    });

    for (let i = 0; i < numWorkers; i += 1) {
        cluster.fork();
    }

    cluster.on('online', (worker) => {
        printLogs({
            shouldPrintLogs: shouldPrintServerLogs,
            messageOrigin: 'API_SERVER',
            messages: `Worker ${worker.process.pid} is online`,
        });
    });

    cluster.on('exit', (worker, code, signal) => {
        printLogs({
            shouldPrintLogs: shouldPrintServerLogs,
            messageOrigin: 'API_SERVER',
            messages: `Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`,
        });
        printLogs({
            shouldPrintLogs: shouldPrintServerLogs,
            messageOrigin: 'API_SERVER',
            messages: 'Starting a new worker',
        });
        cluster.fork();
    });
} else {
    if (process.env.NODE_ENV !== 'development') {
        const httpsCredentials = {
            key: fs.readFileSync(process.env.DOMAIN_KEY_LOCATION),
            cert: fs.readFileSync(process.env.DOMAIN_CERT_LOCATION),
        };

        https.createServer(httpsCredentials, app).listen(globalConfig[process.env.NODE_ENV].apiPort);
    } else {
        app.listen(globalConfig[process.env.NODE_ENV].apiPort, (err: string) => {
            if (err) {
                throw err;
            }
            printLogs({
                shouldPrintLogs: shouldPrintServerLogs,
                messageOrigin: 'API_SERVER',
                messages: [`Server running on port ${globalConfig[process.env.NODE_ENV].apiPort} with process id`, process.pid],
            });
        });
    }
}
