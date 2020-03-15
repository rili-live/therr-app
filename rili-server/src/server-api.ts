import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as cors from 'cors';
import * as path from 'path';
import { argv } from 'yargs';
import connection from './store/connection';
import printLogs from 'rili-public-library/utilities/print-logs';
import AuthRoutes from './api/routes/AuthRoutes';
import UserRoutes from './api/routes/UserRoutes';

export const shouldPrintAllLogs = argv.withAllLogs;
export const shouldPrintSQLLogs =  argv.withSQLLogs || shouldPrintAllLogs;
export const shouldPrintServerLogs = argv.withServerLogs || shouldPrintAllLogs;

const originWhitelist = [process.env.CLIENT_URI];
const corsOptions = {
    origin(origin: any, callback: any) {
        if (originWhitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
};

import { version as packageVersion } from '../package.json';
const API_BASE_ROUTE = `/v${packageVersion.split('.')[0]}`;

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
} else {
    app.use(cors(corsOptions));
}

// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));

// Configure routes
app.use(API_BASE_ROUTE, (new AuthRoutes(connection)).router);
app.use(API_BASE_ROUTE, (new UserRoutes(connection)).router);

const { API_PORT } = process.env;

app.listen(API_PORT, (err: string) => {
    if (err) {
        throw err;
    }
    printLogs({
        shouldPrintLogs: true,
        messageOrigin: 'API_SERVER',
        messages: [`Server running on port ${API_PORT} with process id`, process.pid],
    });
});
