/* eslint-disable import/no-import-module-exports */
import beeline from './beeline'; // eslint-disable-line import/order
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import printLogs from 'therr-js-utilities/print-logs';
import router from './routes';
import honey from './middleware/honey';
import { version as packageVersion } from '../package.json';
import authenticate from './middleware/authenticate';

// Axios defaults
axios.defaults.timeout = 1000 * 30; // 30 Second Request timeout

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

if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
    app.set('trust proxy', 0);
} else {
    // app.use(cors(corsOptions)); // We cannot use cors because mobile apps have no concept of this
    app.use(cors());
    app.set('trust proxy', 1);
}

// Logging Middleware
app.use(honey);

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));

// Authentication
app.use(authenticate.unless({
    path: [
        { url: '/', methods: ['GET'] }, // healthcheck
        { url: /\/v1\/user-files\/.*/, methods: ['GET'] }, // image proxy
        { url: /\/v1\/maps-service\/place\/*/, methods: ['GET'] }, // Google Maps: Places proxy
        { url: '/v1/users-service/subscribers/signup', methods: ['POST'] }, // email marketing subscribe
        { url: '/v1/users-service/auth', methods: ['POST'] }, // login
        { url: '/v1/users-service/payments/webhook', methods: ['POST'] }, // webhook
        { url: '/v1/users-service/users', methods: ['POST'] }, // register
        { url: '/v1/users-service/users/forgot-password', methods: ['POST'] }, // one time password
        { url: /\/v1\/users-service\/users\/verify\/.*/, methods: ['POST'] }, // verify account
        { url: /\/v1\/users-service\/users\/by-username\/.*/, methods: ['GET'] }, // Get public/private profile
        { url: '/v1/users-service/social-sync/oauth2-tiktok', methods: ['GET'] }, // TikTok OAuth
        { url: '/v1/users-service/social-sync/oauth2-facebook', methods: ['GET'] }, // Facebook OAuth
        { url: '/v1/users-service/social-sync/oauth2-instagram', methods: ['GET'] }, // Instagram OAuth
    ],
}));

// Configure routes
app.get('/', (req, res) => { res.status(200).json('OK'); }); // Healthcheck
app.use(API_BASE_ROUTE, router);

const { API_GATEWAY_PORT } = process.env;

const server = app.listen(API_GATEWAY_PORT, () => {
    printLogs({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: [`Server running on port ${API_GATEWAY_PORT} with process id`, process.pid],
        tracer: beeline,
        traceArgs: {
            port: API_GATEWAY_PORT,
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

// Only in development
if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept();
    module.hot.dispose(() => server.close());
}

process.on('uncaughtExceptionMonitor', (err, origin) => {
    printLogs({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        tracer: beeline,
        traceArgs: {
            port: API_GATEWAY_PORT,
            processId: process.pid,
            isUncaughtException: true,
            errorMessage: err?.message,
            errorOrigin: origin,
            source: origin,
        },
    });
});
