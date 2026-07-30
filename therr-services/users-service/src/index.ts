/* eslint-disable import/no-import-module-exports */
import tracing from './tracing'; // eslint-disable-line import/order
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import logSpan from 'therr-js-utilities/log-or-update-span';
import router from './routes';
import reqLogDecorator from './middleware/reqLogDecorator';
import { version as packageVersion } from '../package.json';
import config, { validateEnv } from './config';
import { drainPools } from './store/connection';

validateEnv();
tracing.start();

const API_BASE_ROUTE = `/v${packageVersion.split('.')[0]}`;

const app = express();

// Flipped by the shutdown sequence so the readiness probe starts failing
// immediately on SIGTERM, which pulls this pod out of the Service endpoints
// while it finishes serving whatever is already in flight.
let isShuttingDown = false;

// Once we're draining, tell every client to close its socket after the response.
// The gateway talks to this service over keep-alive connections, and a keep-alive
// socket that goes idle again after its request completes still counts as an open
// connection to server.close() — without this the close callback never fires and
// the pod sits until the hard-timeout backstop kills it on every single deploy.
app.use((req, res, next) => {
    if (isShuttingDown) {
        res.set('Connection', 'close');
    }
    next();
});

// Logging Middleware
app.use(reqLogDecorator);

app.use(helmet());
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(/^(?!\/v1\/users\/connections\/find-people$)/, express.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => {
        // Preserve raw body for Stripe webhook signature verification
        if (req.url?.includes('/payments/webhook') || req.originalUrl?.includes('/payments/webhook')) {
            req.rawBody = buf.toString();
        }
    },
}));

// Mobile apps have no concept of CORS, so we allow all origins across environments
app.use(cors());

// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));

const healthcheck = (req: Request, res: Response) => {
    if (isShuttingDown) {
        res.status(503).json('SHUTTING_DOWN');
        return;
    }
    res.status(200).json('OK');
};

// Configure routes
app.get('/', healthcheck);
app.get('/healthcheck', healthcheck);
app.use(API_BASE_ROUTE, router);

const server = app.listen(config.port, () => {
    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: [`Server (users service) running on port ${config.port} with process id`, process.pid],
        traceArgs: {
            port: config.port,
            'process.id': process.pid,
            // Time from process start to listening — i.e. module load + OTel
            // instrumentation. This is what the k8s startupProbe budget has to
            // cover, so it is worth being able to graph it per deploy.
            'server.bootSeconds': process.uptime(),
        },
    });
});

// Keep-alive sockets outlive a single request, so server.close() would otherwise
// wait on idle connections. Node closes them once they go idle past this.
server.keepAliveTimeout = 30000;
server.headersTimeout = 35000;

// Graceful shutdown on pod eviction.
//
// k8s removes the pod from Service endpoints and sends SIGTERM concurrently, so
// the container also runs a preStop sleep to let endpoint removal land first
// (see k8s/prod/users-service-deployment.yaml). By the time we get here the goal
// is simply: stop accepting new connections, let in-flight requests finish,
// release the DB pools, exit cleanly. The hard timeout is the backstop for a
// request that hangs — it must stay under terminationGracePeriodSeconds so we
// exit on our own terms rather than being SIGKILLed.
const SHUTDOWN_HARD_TIMEOUT_MS = 25000;

let sweepIdle: NodeJS.Timeout;

const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Received shutdown signal, draining connections'],
        traceArgs: {
            'process.id': process.pid,
            'process.signal': signal,
            source: 'users-service',
        },
    });

    const hardExit = setTimeout(() => {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Graceful shutdown timed out, forcing exit'],
            traceArgs: {
                'process.id': process.pid,
                'process.signal': signal,
                source: 'users-service',
            },
        });
        process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    // Don't let the backstop timer itself hold the event loop open.
    hardExit.unref();

    server.close(() => {
        clearInterval(sweepIdle);
        drainPools()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    });

    // Idle keep-alive sockets hold server.close() open without doing any work.
    // Sweeping on an interval (rather than once) also catches sockets that go
    // idle later, as the requests they were serving when SIGTERM arrived finish.
    server.closeIdleConnections?.();
    sweepIdle = setInterval(() => server.closeIdleConnections?.(), 500);
    sweepIdle.unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

if (config.nodeEnv === 'development' && module.hot) {
    module.hot.accept();
    module.hot.dispose(() => server.close());
}

process.on('uncaughtExceptionMonitor', (err, origin) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Uncaught Exception'],
        traceArgs: {
            port: config.port,
            'process.id': process.pid,
            'error.isUncaughtException': true,
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
