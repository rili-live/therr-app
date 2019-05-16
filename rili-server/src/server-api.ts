import * as cluster from 'cluster';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as os from 'os';
import * as path from 'path';
import { argv } from 'yargs';
import * as Knex from 'knex';
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
const dbConnectionConfig = {
    user: globalConfig[process.env.NODE_ENV].postgresUser,
    host: globalConfig[process.env.NODE_ENV].postgresHost,
    database: globalConfig[process.env.NODE_ENV].postgresDatabase,
    password: globalConfig[process.env.NODE_ENV].postgresPassword,
    port: globalConfig[process.env.NODE_ENV].postgresPort,
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

createTables(knex).then(() => {
    app.use('/users', (new UserRoutes(knex)).router);
});

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
