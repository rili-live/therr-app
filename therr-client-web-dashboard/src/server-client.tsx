import beeline from './beeline'; // eslint-disable-line import/order
import axios from 'axios';
import * as path from 'path';
import express from 'express';
import helmet from 'helmet';
import * as React from 'react';
import * as url from 'url';
import * as ReactDOMServer from 'react-dom/server'; // eslint-disable-line import/extensions
import { matchPath } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import ReactGA from 'react-ga4';
import LogRocket from 'logrocket';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import printLogs from 'therr-js-utilities/print-logs';
import { BrandVariations } from 'therr-js-utilities/constants';
import serialize from 'serialize-javascript';
import routeConfig from './routeConfig';
import rootReducer from './redux/reducers';
import socketIOMiddleWare from './socket-io-middleware';
import { getBrandContext } from './utilities/getHostContext';
import * as globalConfig from '../../global-config';

axios.defaults.baseURL = globalConfig[process.env.NODE_ENV].baseApiGatewayRoute;
axios.defaults.headers['x-platform'] = 'desktop';
axios.defaults.headers['x-brand-variation'] = BrandVariations.DASHBOARD_THERR;

// TODO: RFRONT-9: Fix window is undefined hack?
/* eslint-disable */
declare global {
    namespace NodeJS {
        interface Global { // eslint-disable-line
            window: any;
        }
    }
}
/* eslint-enable */

if (!process.env.BROWSER) {
    global.window = ({ document: {} } as any); // Temporarily define window for server-side
    global.document = ({} as any); // Temporarily define window for server-side
}
import Layout from './components/Layout'; // eslint-disable-line
import getRoutes, { IRoute } from './routes'; // eslint-disable-line

// Initialize the server and configure support for handlebars templates
const app = express();

if (process.env.NODE_ENV !== 'development') {
    app.use(helmet());
}
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Define the folder that will be used for static assets
app.use(express.static(path.join(__dirname, '/../build/static/')));
app.get('/robots.txt', express.static(path.join(__dirname, '/../build/static/robots.txt')));

// Universal routing and rendering for SEO
// TODO: Factor in whitelist config
routeConfig.forEach((config) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    let description = config.head.description
    || 'Access your local business dashboard for single origin marketing';

    app.get(routePath, (req, res) => {
        const brandContext = getBrandContext(req.hostname);
        const brandName = brandContext.brandName;
        const host = brandContext.host;
        // TODO: Define all variations (sizes, platforms) of the favicon icons
        const faviconFileName = brandContext.faviconFileName;
        const metaImageFileName = brandContext.metaImageFileName;
        description = description.replace('Therr for Business', brandName); // See views/index.hbs
        const promises: any = [];
        const staticContext: any = {};
        const initialState: any = {
            user: {
                details: {},
            },
        };

        const store = configureStore({
            reducer: rootReducer,
            preloadedState: initialState,
            middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(socketIOMiddleWare).concat(LogRocket.reduxMiddleware()),
        });

        getRoutes({
            isAuthorized: () => true, // This is a noop since we don't need to check auth in order to fetch data
        }).some((route: IRoute) => {
            const match = matchPath(route.path, req.path);
            if (match && route.fetchData) {
                const Comp = route.element;
                const initData = (Comp && route.fetchData) || (() => Promise.resolve());
                // fetchData calls a dispatch on the store updating the current state before render
                promises.push(initData(store.dispatch, match.params)
                    .catch((error) => {
                        printLogs({
                            level: 'error',
                            messageOrigin: 'SERVER_CLIENT',
                            messages: 'Failed to prefetch data',
                            tracer: beeline,
                            traceArgs: {
                                errorMessage: error?.message,
                            },
                        });
                    }));
            }
            return !!match;
        });

        Promise.all(promises).then(([initialData]) => {
            const markup = ReactDOMServer.renderToString(
                <Provider store={store}>
                    <StaticRouter location={req.url}>
                        <Layout />
                    </StaticRouter>
                </Provider>,
            );

            // This gets the initial state created after all dispatches are called in fetchData
            Object.assign(initialState, store.getState());

            const state = serialize(initialState, {
                isJSON: true,
            }).replace(/</g, '\\u003c').replace(/\\n/g, '\\u0085').replace(/\\r/g, '\\u000D');

            if (staticContext.url) {
                printLogs({
                    level: 'info',
                    messageOrigin: 'SERVER_CLIENT',
                    messages: 'Somewhere a <Redirect> was rendered',
                    tracer: beeline,
                    traceArgs: {
                        redirectUrl: staticContext.url,
                    },
                });
                res.writeHead(staticContext.statusCode, {
                    Location: staticContext.url,
                });
                res.end();
            } else {
                ReactGA.send({ hitType: 'pageview', page: req.path, title });
                return res.render(routeView, {
                    brandName,
                    title,
                    description,
                    faviconFileName,
                    host,
                    markup,
                    metaImageFileName,
                    routePath,
                    state,
                });
            }
        }).catch((err) => {
            console.log(err);
        });
    });
});

// Start the server
const port = process.env.CLIENT_DASHBOARD_PORT;
app.listen(port, () => {
    printLogs({
        level: 'info',
        messageOrigin: 'SERVER_CLIENT',
        messages: `Server running on port, ${port}, with process id ${process.pid}`,
        tracer: beeline,
        traceArgs: {
            port,
            processId: process.pid,
        },
    });
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    printLogs({
        level: 'error',
        messageOrigin: 'SERVER_CLIENT',
        messages: ['Uncaught Exception'],
        tracer: beeline,
        traceArgs: {
            port: process.env.CLIENT_DASHBOARD_PORT,
            processId: process.pid,
            isUncaughtException: true,
            errorMessage: err?.message,
            errorOrigin: origin,
            source: origin,
        },
    });
});
