/* eslint-disable import/no-import-module-exports */
import tracing from './tracing'; // eslint-disable-line import/order
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import logSpan from 'therr-js-utilities/log-or-update-span';
import router from './routes';
import reqLogDecorator from './middleware/reqLogDecorator';
import { version as packageVersion } from '../package.json';
import authenticate from './middleware/authenticate';
import restrictApiKeyAccess from './middleware/restrictApiKeyAccess';
import { apiKeyRequestLimiter } from './services/users/limitation/apiKeys';
import openapiSpec from './docs/openapi.json';
import getRedocHtml from './docs/redocPage';

tracing.start();

// Axios defaults
axios.defaults.timeout = 1000 * 30; // 30 Second Request timeout

// NOTE: corsOptions commented out - mobile apps have no concept of CORS
// const originWhitelist = (process.env.URI_WHITELIST || '').split(',');
// const corsOptions = {
//     origin(origin: any, callback: any) {
//         if (origin === undefined || originWhitelist.indexOf(origin) !== -1) {
//             callback(null, true);
//         } else {
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
// };

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

// Authentication
app.use(authenticate.unless({
    path: [
        { url: '/', methods: ['GET'] }, // healthcheck
        { url: '/healthcheck', methods: ['GET'] }, // healthcheck
        { url: '/v1/docs', methods: ['GET'] }, // API documentation
        { url: '/v1/docs/openapi.json', methods: ['GET'] }, // OpenAPI spec
        // { url: '/favicon.ico', methods: ['GET'] }, // favicon
        { url: '/v1/users-service/interests', methods: ['GET'] },
        { url: '/v1/users-service/rewards/exchange-rate', methods: ['GET'] },
        { url: '/v1/users-service/emails/bounced', methods: ['POST'] }, // bounced email handler
        { url: '/v1/users-service/subscribers/signup', methods: ['POST'] }, // email marketing subscribe
        { url: '/v1/users-service/subscribers/preferences', methods: ['GET'] }, // Update E-mail subscription settings
        { url: '/v1/users-service/subscribers/unsubscribe', methods: ['POST'] }, // Update E-mail subscription settings
        { url: '/v1/users-service/subscribers/send-feedback', methods: ['POST'] }, // send feedback
        { url: '/v1/users-service/auth', methods: ['POST'] }, // login
        { url: '/v1/users-service/payments/webhook', methods: ['POST'] }, // webhook
        { url: '/v1/users-service/users', methods: ['POST'] }, // register
        { url: /\/v1\/users-service\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, methods: ['GET'] },
        { url: '/v1/users-service/auth/token/refresh', methods: ['POST'] }, // token refresh
        { url: '/v1/users-service/auth/email-precheck', methods: ['POST'] }, // multi-app email lookup (enumeration-safe)
        { url: '/v1/users-service/auth/handoff/redeem', methods: ['POST'] }, // cross-app handoff: code IS the credential
        { url: '/v1/users-service/users/forgot-password', methods: ['POST'] }, // one time password
        { url: '/v1/users-service/social-sync/oauth2-tiktok', methods: ['GET'] }, // TikTok OAuth
        { url: '/v1/users-service/social-sync/oauth2-facebook', methods: ['GET'] }, // Facebook OAuth
        { url: '/v1/users-service/social-sync/oauth2-dashboard-facebook', methods: ['GET'] }, // Facebook OAuth
        { url: '/v1/users-service/social-sync/oauth2-instagram', methods: ['GET'] }, // Instagram OAuth
        { url: /\/v1\/users-service\/users\/verify\/.*/, methods: ['POST'] }, // verify account
        { url: /\/v1\/users-service\/users\/by-username\/.*/, methods: ['GET'] }, // Get public/private profile
        { url: /\/v1\/user-files\/.*/, methods: ['GET'] }, // image proxy
        { url: /\/v1\/maps-service\/place\/*/, methods: ['GET'] }, // Google Maps: Places proxy
        { url: '/v1/maps-service/geocode', methods: ['GET'] }, // Nominatim geocoding proxy
        { url: /\/v1\/maps-service\/moments\/.*\/details/, methods: ['POST'] },
        { url: '/v1/maps-service/spaces/list', methods: ['POST'] },
        { url: /\/v1\/maps-service\/spaces\/.*\/details/, methods: ['POST'] },
        { url: /\/v1\/maps-service\/events\/.*\/details/, methods: ['POST'] }, // Public event view (uses authenticateOptional)
        { url: /\/v1\/maps-service\/events\/search/, methods: ['POST'] }, // Optional for public map view
        { url: /\/v1\/maps-service\/moments\/search/, methods: ['POST'] }, // Optional for public map view
        { url: /\/v1\/maps-service\/spaces\/search/, methods: ['POST'] }, // Optional for public map view
        { url: /\/v1\/maps-service\/spaces\/.*\/pairings$/, methods: ['GET'] }, // Space pairings (optional auth)
        { url: /\/v1\/maps-service\/spaces\/.*\/pairings\/feedback/, methods: ['POST'] }, // Pairing feedback (optional auth)
        { url: /\/v1\/maps-service\/cities\/[^/]+\/pulse$/, methods: ['GET'] }, // Public city landing page (uses authenticateOptional)
        { url: /\/v1\/messages-service\/forums\/[0-9a-f-]+$/, methods: ['GET'] }, // Public group/forum view (uses authenticateOptional)
        { url: '/v1/messages-service/forums/search', methods: ['POST'] }, // Public forum search (uses authenticateOptional)
        { url: /\/v1\/reactions-service\/user-lists\/public\/[0-9a-f-]+\/[a-z0-9-]+$/, methods: ['GET'] }, // Public shareable list page
    ],
}));

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
