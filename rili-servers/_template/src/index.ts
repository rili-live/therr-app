import beeline from './beeline'; // eslint-disable-line import/order
import * as bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import printLogs from 'rili-public-library/rili-js-utilities/print-logs';
import router from './routes';
import honey from './middleware/honey';
import { version as packageVersion } from '../package.json';
import authenticate from './middleware/authenticate';

const originWhitelist = (process.env.URI_WHITELIST || '').split(',');
const corsOptions = {
    origin(origin: any, callback: any) {
        if (origin === undefined || originWhitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
};

const API_BASE_ROUTE = `/v${packageVersion.split('.')[0]}`;

const app = express();

// Logging Middleware
app.use(honey);

app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
} else {
    app.use(cors(corsOptions));
}

// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));

// Authentication
app.use(authenticate.unless({
    path: [
        { url: '/', methods: ['GET'] },
    ],
}));

// Configure routes
app.get('/', (req, res) => { res.status(200).json('OK'); }); // Healthcheck
app.use(API_BASE_ROUTE, router);

const { NEW_SERVICE_API_PORT } = process.env;

const server = app.listen(NEW_SERVICE_API_PORT, () => {
    printLogs({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: [`Server running on port ${NEW_SERVICE_API_PORT} with process id`, process.pid],
        tracer: beeline,
        traceArgs: {
            port: NEW_SERVICE_API_PORT,
            processId: process.pid,
        },
    });
});

// Hot Module Reloading
type ModuleId = string | number;

interface WebpackHotModule {
    hot?: {
        data: any;
        accept(
            dependencies: string[],
            callback?: (updatedDependencies: ModuleId[]) => void,
        ): void;
        accept(dependency: string, callback?: () => void): void;
        accept(errHandler?: (err: Error) => void): void;
        dispose(callback: (data: any) => void): void;
    };
}

declare const module: WebpackHotModule;

if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept();
    module.hot.dispose(() => server.close());
}
