/* eslint-disable import/no-import-module-exports */
import tracing from './tracing'; // eslint-disable-line import/order
import axios from 'axios';
import * as http from 'http';
import * as https from 'https';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import logSpan from 'therr-js-utilities/log-or-update-span';
import router from './routes';
import reqLogDecorator from './middleware/reqLogDecorator';
import { version as packageVersion } from '../package.json';
import authenticate from './middleware/authenticate';
import unauthenticatedPaths from './config/unauthenticatedPaths';
import restrictApiKeyAccess from './middleware/restrictApiKeyAccess';
import { apiKeyRequestLimiter } from './services/users/limitation/apiKeys';
import openapiSpec from './docs/openapi.json';
import getRedocHtml from './docs/redocPage';

tracing.start();

// Axios defaults
axios.defaults.timeout = 1000 * 30; // 30 Second Request timeout
// Shared keep-alive agents reuse TCP connections across requests to the same host,
// avoiding repeated DNS lookups and TCP handshakes on every axios call. Defined here
// (rather than imported from therr-js-utilities/http) so the isomorphic http barrel stays
// free of node-only `http`/`https`, which would otherwise break the React Native bundle.
axios.defaults.httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
});
axios.defaults.httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 25,
    maxFreeSockets: 5,
});

// Mobile apps send no Origin header, so passing `!origin` through is safe and required.
// Web clients are restricted to the URI_WHITELIST in production so any other browser origin
// is rejected by CORS preflight before reaching the route handler.
const originWhitelist = (process.env.URI_WHITELIST || '').split(',').filter(Boolean);
const corsOptions = {
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        if (!origin || originWhitelist.includes(origin)) {
            callback(null, true);
            return;
        }

        // Resolve to `false` rather than an Error. Passing an Error routes through the
        // express error handler and returns an opaque 500 with no indication of the cause;
        // `false` simply omits the Access-Control-Allow-Origin header, which is what the
        // browser is actually checking. Log the rejected origin so a missing whitelist
        // entry is diagnosable from traces instead of only from the browser console.
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: [`CORS rejected origin: ${origin}`],
            traceArgs: {
                'cors.rejectedOrigin': origin,
                'cors.whitelistSize': originWhitelist.length,
            },
        });
        callback(null, false);
    },
};

const API_BASE_ROUTE = `/v${packageVersion.split('.')[0]}`;

const app = express();

if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
    app.set('trust proxy', 0);
} else {
    app.use(cors(corsOptions));
    app.set('trust proxy', 1);
}

// Open Telemetry Logging Middleware
app.use(reqLogDecorator);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': ["'self'", 'https://cdn.redoc.ly'],
            'worker-src': ["'self'", 'blob:'],
            'connect-src': ["'self'", 'https://cdn.redoc.ly'],
            'img-src': ["'self'", 'data:', 'https://cdn.redoc.ly'],
        },
    },
}));
app.use(express.urlencoded({ extended: true }));
// Use defaults except for specific route in regex
app.use(/^(?!\/v1\/users-service\/users\/connections\/find-people$)/, express.json({
    type: [
        'application/json',
        'text/plain', // AWS sends this content-type for its messages/notifications
    ],
}));

// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));

// Authentication. The skip-list lives in its own module so it can be unit-tested;
// see config/unauthenticatedPaths.ts for why anchoring those patterns matters.
app.use(authenticate.unless({ path: unauthenticatedPaths }));

// API key access restrictions and rate limiting (after auth, before routes)
app.use(restrictApiKeyAccess);
app.use((req, res, next) => {
    // Only apply API key rate limiter to API-key-authenticated requests
    if (req['x-auth-type'] === 'api-key') {
        return apiKeyRequestLimiter(req, res, next);
    }
    return next();
});

// Configure routes
app.get('/', (req, res) => { res.status(200).json('OK'); }); // Healthcheck
app.get('/healthcheck', (req, res) => { res.status(200).json('OK'); }); // Healthcheck

// API Documentation (public, unauthenticated)
app.get(`${API_BASE_ROUTE}/docs/openapi.json`, (req, res) => { res.json(openapiSpec); });
app.get(`${API_BASE_ROUTE}/docs`, (req, res) => { res.send(getRedocHtml()); });

app.use(API_BASE_ROUTE, router);

const { API_GATEWAY_PORT } = process.env;

const server = app.listen(API_GATEWAY_PORT, () => {
    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: [`Server running on port ${API_GATEWAY_PORT} with process id`, process.pid],
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
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        traceArgs: {
            port: API_GATEWAY_PORT,
            'process.pid': process.pid,
            isUncaughtException: true,
            'error.message': err?.message,
            'error.origin': origin,
            source: origin,
        },
    });
});

process.on('uncaughtException', (err, origin) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception - Shutting down'],
        traceArgs: {
            'error.message': err?.message,
            'process.origin': origin,
        },
    });
    setTimeout(() => process.exit(1), 1000);
});
