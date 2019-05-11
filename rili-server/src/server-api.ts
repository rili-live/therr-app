import * as cluster from 'cluster';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as os from 'os';
import * as path from 'path';
import { Pool, Client } from 'pg';
import { argv } from 'yargs';
import printLogs from 'rili-public-library/utilities/print-logs';
import * as globalConfig from '../../global-config.js';
import createTables from './db/create-tables';
import UserRoutes from './routes/UserRoutes';

export const shouldPrintAllLogs = argv.withAllLogs;
export const shouldPrintSQLLogs =  argv.withSQLLogs || shouldPrintAllLogs;

const app = express();

// Parse JSON
app.use(bodyParser.json());

// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));

// Databse Connection
const postgressConfig = {
    user: globalConfig[process.env.NODE_ENV].postgresUser,
    host: globalConfig[process.env.NODE_ENV].postgresHost,
    database: globalConfig[process.env.NODE_ENV].postgresDatabase,
    password: globalConfig[process.env.NODE_ENV].postgresPassword,
    port: globalConfig[process.env.NODE_ENV].postgresPort,
};

// Db Pool
const pool = new Pool(postgressConfig);
pool.on('error', (err, client) => {
    printLogs({
        shouldPrintLogs: shouldPrintSQLLogs,
        messageOrigin: `SQL:POOL:ERROR`,
        messages: [client.toString(), err.toString()],
    });
});

// Db Client
const client = new Client(postgressConfig);
client.connect((err) => {
    if (err) {
        printLogs({
            shouldPrintLogs: shouldPrintSQLLogs,
            messageOrigin: `SQL:CLIENT:CONNECTION_ERROR`,
            messages: [err.toString()],
        });
    } else {
        printLogs({
            shouldPrintLogs: shouldPrintSQLLogs,
            messageOrigin: `SQL:CLIENT:CONNECTION_SUCCESS`,
            messages: ['Client connected to PostgreSQL'],
        });
        // Create or update database tables (if they don't yet exist)
        createTables(client);
    }
});

client.on('error', (err) => {
    printLogs({
        shouldPrintLogs: shouldPrintSQLLogs,
        messageOrigin: `SQL:CLIENT:ERROR`,
        messages: [err.toString()],
    });
});

// Routes
app.use('/users', (new UserRoutes(pool)).router);

// Cluster config and server start
if (cluster.isMaster && argv.shouldCluster) {
    const numWorkers = os.cpus().length;

    console.log(`Master cluster setting up ${numWorkers} workers...`); // tslint:disable-line no-console

    for (let i = 0; i < numWorkers; i += 1) {
        cluster.fork();
    }

    cluster.on('online', (worker) => {
        console.log(`Worker ${worker.process.pid} is online`); // tslint:disable-line no-console
    });

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`); // tslint:disable-line no-console
        console.log('Starting a new worker'); // tslint:disable-line no-console
        cluster.fork();
    });
} else {
    app.listen(globalConfig[process.env.NODE_ENV].apiPort, (err: string) => {
        if (err) {
            throw err;
        }
        console.log(`Server running on port ${globalConfig[process.env.NODE_ENV].apiPort} with process id`, process.pid); // tslint:disable-line no-console
    });
}
