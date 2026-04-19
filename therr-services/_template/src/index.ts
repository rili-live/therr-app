import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import logSpan from 'therr-js-utilities/log-or-update-span';
import router from './routes';
import honey from './middleware/honey';
import { version as packageVersion } from '../package.json';

const API_BASE_ROUTE = `/v${packageVersion.split('.')[0]}`;

const app = express();

// Logging Middleware
app.use(honey);

app.use(helmet());
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// Mobile apps have no concept of CORS, so we allow all origins across environments
app.use(cors());

// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));

// Configure routes
app.get('/', (req, res) => { res.status(200).json('OK'); }); // Healthcheck
app.use(API_BASE_ROUTE, router);

const { NEW_SERVICE_API_PORT } = process.env;

const server = app.listen(NEW_SERVICE_API_PORT, () => {
    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: [`Server (new service) running on port ${NEW_SERVICE_API_PORT} with process id`, process.pid],
        traceArgs: {
            port: NEW_SERVICE_API_PORT,
            'process.id': process.pid,
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
