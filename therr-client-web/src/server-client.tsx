import beeline from './beeline'; // eslint-disable-line import/order
import axios from 'axios';
import * as path from 'path';
import compression from 'compression';
import express from 'express';
import expressStaticGzip from 'express-static-gzip';
import helmet from 'helmet';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server'; // eslint-disable-line import/extensions
import { matchPath } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
// ReactGA removed from server — analytics should only run client-side
// LogRocket removed from server — session replay only runs client-side
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { GoogleOAuthProvider } from '@react-oauth/google';
import printLogs from 'therr-js-utilities/print-logs';
import serialize from 'serialize-javascript';
import { BrandVariations, Categories, Content } from 'therr-js-utilities/constants';
import { buildSpaceSlug } from 'therr-js-utilities/slugify';
import routeConfig from './routeConfig';
import rootReducer from './redux/reducers';
import socketIOMiddleWare from './socket-io-middleware';
import getUserImageUri from './utilities/getUserImageUri';
import * as globalConfig from '../../global-config';
import getUserContentUri from './utilities/getUserContentUri';

axios.defaults.baseURL = (globalConfig[process.env.NODE_ENV] || globalConfig.production).baseApiGatewayRoute;
axios.defaults.headers['x-platform'] = 'desktop';
axios.defaults.headers['x-brand-variation'] = BrandVariations.THERR;

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
import mantineTheme from './styles/mantine-theme'; // eslint-disable-line

// Initialize the server and configure support for handlebars templates
const app = express();

// Trust the reverse proxy (Nginx Ingress) to provide real client IP via
// X-Forwarded-For. Value of 1 = trust one proxy hop (Nginx Ingress).
// Increase to 2 when Cloudflare is added in front of the ingress.
if (process.env.NODE_ENV !== 'development') {
    app.set('trust proxy', 1);
}

// Enable gzip/deflate compression for all responses
app.use(compression());

if (process.env.NODE_ENV !== 'development') {
    app.use(helmet({
        // Allow Google Sign-In popup to communicate back via postMessage
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
        // Use strict-origin-when-cross-origin so OSM tile servers receive a Referer header
        // (Helmet defaults to no-referrer which causes OSM to block tile requests)
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                connectSrc: [
                    "'self'",
                    'https://*.therr.com',
                    'wss://*.therr.com',
                    // LogRocket
                    'https://*.lr-in-prod.com',
                    'https://*.lr-ingest.com',
                    'https://*.logrocket.io',
                    'https://*.logrocket.com',
                    // Google Analytics
                    'https://*.google-analytics.com',
                    'https://*.analytics.google.com',
                    'https://*.googletagmanager.com',
                    // Google Sign-In
                    'https://accounts.google.com',
                    // Map tile providers (Carto CDN)
                    'https://*.basemaps.cartocdn.com',
                    // Cloudflare Insights beacon
                    'https://static.cloudflareinsights.com',
                ],
                frameSrc: [
                    "'self'",
                    'https://accounts.google.com',
                ],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    'https://*.googletagmanager.com',
                    'https://*.google-analytics.com',
                    'https://cdn.lr-in-prod.com',
                    'https://cdn.lr-ingest.com',
                    // Google Sign-In
                    'https://accounts.google.com',
                    // Cloudflare Insights / Web Analytics
                    'https://static.cloudflareinsights.com',
                ],
                // Disable Helmet's default script-src-attr 'none' which blocks inline
                // event handlers from third-party scripts (Google Sign-In, analytics, etc.)
                scriptSrcAttr: null,
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    'https://fonts.googleapis.com',
                    // Google Sign-In
                    'https://accounts.google.com',
                ],
                fontSrc: [
                    "'self'",
                    'https://fonts.gstatic.com',
                ],
                imgSrc: [
                    "'self'",
                    'data:',
                    'https://*.therr.com',
                    'https://ik.imagekit.io',
                    'https://robohash.org',
                    'https://*.google-analytics.com',
                    'https://*.googletagmanager.com',
                    // Leaflet map tiles and marker icons
                    'https://*.tile.openstreetmap.org',
                    'https://*.basemaps.cartocdn.com',
                    'https://unpkg.com',
                ],
                workerSrc: ["'self'", 'blob:'],
            },
        },
    }));
}
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Define the folder that will be used for static assets
// Serves pre-compressed .br and .gz files when the client supports them
app.use(expressStaticGzip(path.join(__dirname, '/../build/static/'), {
    enableBrotli: true,
    orderPreference: ['br', 'gzip'],
    serveStatic: {
        index: false,
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
        },
    },
}));
app.get('/robots.txt', express.static(path.join(__dirname, '/../build/static/robots.txt')));
app.get('/llms.txt', express.static(path.join(__dirname, '/../build/static/llms.txt')));
app.get('/opensearch.xml', express.static(path.join(__dirname, '/../build/static/opensearch.xml')));

// IndexNow key file endpoint for Bing/Yandex verification
// Key must be alphanumeric/hyphens only (8-128 chars) to prevent route injection
const indexNowKey = process.env.INDEXNOW_API_KEY;
if (indexNowKey && /^[a-zA-Z0-9-]{8,128}$/.test(indexNowKey)) {
    app.get(`/${indexNowKey}.txt`, (req, res) => {
        res.type('text/plain').send(indexNowKey);
    });
}

// Dynamic sitemap index with paginated space sub-sitemaps
const SITEMAP_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ITEMS_PER_SITEMAP = 1000;
const SPACES_PER_SITEMAP = ITEMS_PER_SITEMAP;

// Cache for sitemap pages: key is page identifier (e.g., 'index', 'static', 'spaces-1')
const sitemapCaches: Record<string, { xml: string; timestamp: number }> = {};

const getSitemapCache = (key: string): string | null => {
    const cached = sitemapCaches[key];
    if (cached && (Date.now() - cached.timestamp) < SITEMAP_CACHE_TTL) {
        return cached.xml;
    }
    return null;
};

const setSitemapCache = (key: string, xml: string) => {
    sitemapCaches[key] = { xml, timestamp: Date.now() };
};

// Build URL entries for English (unprefixed), Spanish (/es), and French Canadian (/fr) versions
// eslint-disable-next-line max-len
const buildUrlSet = (loc: string, lastmod: string, priority: string) => {
    const esLoc = loc === '/' ? '/es' : `/es${loc}`;
    const frLoc = loc === '/' ? '/fr' : `/fr${loc}`;
    // eslint-disable-next-line max-len
    const hreflangLinks = `    <xhtml:link rel="alternate" hreflang="en-US" href="https://www.therr.com${loc}" />\n    <xhtml:link rel="alternate" hreflang="es-MX" href="https://www.therr.com${esLoc}" />\n    <xhtml:link rel="alternate" hreflang="fr-CA" href="https://www.therr.com${frLoc}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="https://www.therr.com${loc}" />`;
    // eslint-disable-next-line max-len
    const enEntry = `  <url>\n    <loc>https://www.therr.com${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n${hreflangLinks}\n  </url>`;
    // eslint-disable-next-line max-len
    const esEntry = `  <url>\n    <loc>https://www.therr.com${esLoc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n${hreflangLinks}\n  </url>`;
    // eslint-disable-next-line max-len
    const frEntry = `  <url>\n    <loc>https://www.therr.com${frLoc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n${hreflangLinks}\n  </url>`;
    return `${enEntry}\n${esEntry}\n${frEntry}`;
};

// Fetch a page of spaces for sitemap generation
// latitude=0&longitude=0 with a global distanceOverride fetches all spaces regardless of location
const fetchSpacesPage = async (pageNumber: number): Promise<any[]> => {
    const response = await axios.post(
        `/maps-service/spaces/list?itemsPerPage=${SPACES_PER_SITEMAP}&pageNumber=${pageNumber}&latitude=0&longitude=0`,
        { distanceOverride: 40075 * (1000 / 2) },
    );
    return response?.data?.results || [];
};

// Fetch a page of events for sitemap generation
// latitude=0&longitude=0 with a global distanceOverride fetches all events regardless of location
const fetchEventsPage = async (pageNumber: number): Promise<any[]> => {
    const response = await axios.post(
        // eslint-disable-next-line max-len
        `/maps-service/events/search?itemsPerPage=${ITEMS_PER_SITEMAP}&pageNumber=${pageNumber}&latitude=0&longitude=0`,
        { distanceOverride: 40075 * (1000 / 2) },
    );
    return response?.data?.results || [];
};

// Fetch a page of public groups/forums for sitemap generation
const fetchGroupsPage = async (pageNumber: number): Promise<any[]> => {
    const response = await axios.post(
        `/messages-service/forums/search?itemsPerPage=${ITEMS_PER_SITEMAP}&pageNumber=${pageNumber}`,
        {},
    );
    return response?.data?.results || [];
};

// Discover total pages for a given fetch function
const discoverTotalPages = async (
    fetchFn: (page: number) => Promise<any[]>,
): Promise<number> => {
    let totalPages = 0;
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        // eslint-disable-next-line no-await-in-loop
        const results = await fetchFn(page);
        if (results.length > 0) {
            totalPages = page;
        }
        if (results.length < ITEMS_PER_SITEMAP) {
            break;
        }
        page += 1;
    }
    return totalPages;
};

// Sitemap index: /sitemap.xml
// Discovers total pages by fetching spaces until an empty page is returned
app.get('/sitemap.xml', async (req, res) => {
    const cached = getSitemapCache('index');
    if (cached) {
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        return res.send(cached);
    }

    let totalSpacePages = 0;
    let totalEventPages = 0;
    let totalGroupPages = 0;

    try {
        totalSpacePages = await discoverTotalPages(fetchSpacesPage);
    } catch (err) {
        printLogs({
            level: 'error',
            messageOrigin: 'SERVER_CLIENT',
            messages: 'Failed to fetch space count for sitemap index',
            tracer: beeline,
            traceArgs: { errorMessage: (err as any)?.message },
        });
        totalSpacePages = 1;
    }

    try {
        totalEventPages = await discoverTotalPages(fetchEventsPage);
    } catch (err) {
        printLogs({
            level: 'error',
            messageOrigin: 'SERVER_CLIENT',
            messages: 'Failed to fetch event count for sitemap index',
            tracer: beeline,
            traceArgs: { errorMessage: (err as any)?.message },
        });
    }

    try {
        totalGroupPages = await discoverTotalPages(fetchGroupsPage);
    } catch (err) {
        printLogs({
            level: 'error',
            messageOrigin: 'SERVER_CLIENT',
            messages: 'Failed to fetch group count for sitemap index',
            tracer: beeline,
            traceArgs: { errorMessage: (err as any)?.message },
        });
    }

    const today = new Date().toISOString().split('T')[0];

    const sitemaps = [
        `  <sitemap>\n    <loc>https://www.therr.com/sitemap-static.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
        ...Array.from({ length: totalSpacePages }, (_, i) => (
            // eslint-disable-next-line max-len
            `  <sitemap>\n    <loc>https://www.therr.com/sitemap-spaces-${i + 1}.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
        )),
        ...Array.from({ length: totalEventPages }, (_, i) => (
            // eslint-disable-next-line max-len
            `  <sitemap>\n    <loc>https://www.therr.com/sitemap-events-${i + 1}.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
        )),
        ...Array.from({ length: totalGroupPages }, (_, i) => (
            // eslint-disable-next-line max-len
            `  <sitemap>\n    <loc>https://www.therr.com/sitemap-groups-${i + 1}.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
        )),
    ];

    // eslint-disable-next-line max-len
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps.join('\n')}\n</sitemapindex>`;

    setSitemapCache('index', xml);
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(xml);
});

// Static pages sitemap: /sitemap-static.xml
app.get('/sitemap-static.xml', (req, res) => {
    const cached = getSitemapCache('static');
    if (cached) {
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        return res.send(cached);
    }

    // Category landing pages for SEO (e.g. /locations/restaurants, /locations/bars)
    const categoryUrls = Object.values(Categories.CategorySlugMap).map((slug) => ({
        loc: `/locations/${slug}`,
        priority: '0.85',
    }));

    const staticUrls = [
        { loc: '/', priority: '1.0' },
        { loc: '/login', priority: '0.8' },
        { loc: '/register', priority: '0.8' },
        { loc: '/locations', priority: '0.9' },
        ...categoryUrls,
    ];

    const today = new Date().toISOString().split('T')[0];
    const urls = staticUrls.map((u) => buildUrlSet(u.loc, today, u.priority));

    // eslint-disable-next-line max-len
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;

    setSitemapCache('static', xml);
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(xml);
});

// Paginated spaces sitemaps: /sitemap-spaces-1.xml, /sitemap-spaces-2.xml, etc.
app.get(/^\/sitemap-spaces-(\d+)\.xml$/, async (req, res) => {
    const page = parseInt(req.params[0], 10);
    if (page < 1 || Number.isNaN(page)) {
        return res.status(404).send('Not found');
    }

    const cacheKey = `spaces-${page}`;
    const cached = getSitemapCache(cacheKey);
    if (cached) {
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        return res.send(cached);
    }

    let spaces: any[] = [];
    try {
        spaces = await fetchSpacesPage(page);
    } catch (err) {
        console.log(err);
        printLogs({
            level: 'error',
            messageOrigin: 'SERVER_CLIENT',
            messages: `Failed to fetch spaces for sitemap page ${page}`,
            tracer: beeline,
            traceArgs: { errorMessage: (err as any)?.message },
        });
    }

    if (spaces.length === 0) {
        return res.status(404).send('Not found');
    }

    // Filter out non-public spaces (e.g. businesses marked as closed).
    // The API does not filter by isPublic, so we must do it client-side.
    // This may result in some sitemap pages having fewer entries than SPACES_PER_SITEMAP.
    const publicSpaces = spaces.filter((space: any) => space.isPublic !== false);

    if (publicSpaces.length === 0) {
        return res.status(404).send('Not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const urls = publicSpaces.map((space: any) => {
        const lastmod = space.updatedAt ? new Date(space.updatedAt).toISOString().split('T')[0] : today;
        const slug = buildSpaceSlug(space.notificationMsg, space.addressLocality, space.addressRegion);
        const spacePath = slug ? `/spaces/${space.id}/${slug}` : `/spaces/${space.id}`;
        return buildUrlSet(spacePath, lastmod, '0.7');
    });

    // eslint-disable-next-line max-len
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;

    setSitemapCache(cacheKey, xml);
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(xml);
});

// Paginated events sitemaps: /sitemap-events-1.xml, /sitemap-events-2.xml, etc.
app.get(/^\/sitemap-events-(\d+)\.xml$/, async (req, res) => {
    const page = parseInt(req.params[0], 10);
    if (page < 1 || Number.isNaN(page)) {
        return res.status(404).send('Not found');
    }

    const cacheKey = `events-${page}`;
    const cached = getSitemapCache(cacheKey);
    if (cached) {
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        return res.send(cached);
    }

    let events: any[] = [];
    try {
        events = await fetchEventsPage(page);
    } catch (err) {
        console.log(err);
        printLogs({
            level: 'error',
            messageOrigin: 'SERVER_CLIENT',
            messages: `Failed to fetch events for sitemap page ${page}`,
            tracer: beeline,
            traceArgs: { errorMessage: (err as any)?.message },
        });
    }

    // Filter out non-public events (API does not filter by isPublic)
    const publicEvents = events.filter((event: any) => event.isPublic !== false);

    if (publicEvents.length === 0) {
        return res.status(404).send('Not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const urls = publicEvents.map((event: any) => {
        const lastmod = event.updatedAt ? new Date(event.updatedAt).toISOString().split('T')[0] : today;
        return buildUrlSet(`/events/${event.id}`, lastmod, '0.7');
    });

    // eslint-disable-next-line max-len
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;

    setSitemapCache(cacheKey, xml);
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(xml);
});

// Paginated groups sitemaps: /sitemap-groups-1.xml, /sitemap-groups-2.xml, etc.
app.get(/^\/sitemap-groups-(\d+)\.xml$/, async (req, res) => {
    const page = parseInt(req.params[0], 10);
    if (page < 1 || Number.isNaN(page)) {
        return res.status(404).send('Not found');
    }

    const cacheKey = `groups-${page}`;
    const cached = getSitemapCache(cacheKey);
    if (cached) {
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        return res.send(cached);
    }

    let groups: any[] = [];
    try {
        groups = await fetchGroupsPage(page);
    } catch (err) {
        printLogs({
            level: 'error',
            messageOrigin: 'SERVER_CLIENT',
            messages: `Failed to fetch groups for sitemap page ${page}`,
            tracer: beeline,
            traceArgs: { errorMessage: (err as any)?.message },
        });
    }

    // Filter out non-public groups (API does not filter by isPublic)
    const publicGroups = groups.filter((group: any) => group.isPublic !== false);

    if (publicGroups.length === 0) {
        return res.status(404).send('Not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const urls = publicGroups.map((group: any) => {
        const lastmod = group.updatedAt ? new Date(group.updatedAt).toISOString().split('T')[0] : today;
        return buildUrlSet(`/groups/${group.id}`, lastmod, '0.7');
    });

    // eslint-disable-next-line max-len
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;

    setSitemapCache(cacheKey, xml);
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(xml);
});

app.get('/healthcheck', (req, res) => { res.status(200).json('OK'); }); // Healthcheck

const appLinksJson = {
    applinks: {
        apps: [],
        details: [
            {
                appID: '22AN4MZ6H5.com.therr.mobile.Therr',
                paths: ['*'],
            },
        ],
    },
};

// Apple universal link (Opens ios app when clicking therr URLs from mobile)
app.get('/apple-app-site-association', (req, res) => res.status(200).json(appLinksJson));
// app.get('/.well-known/apple-app-site-association', (req, res) => res.status(200).json(appLinksJson));

// Redirect bare domain to www (preserves path and query string)
app.use((req, res, next) => {
    const host = req.hostname;
    if (host === 'therr.com') {
        return res.redirect(301, `https://www.therr.com${req.originalUrl}`);
    }
    next();
});

// Locale URL prefix support
const prefixToLocale: Record<string, string> = { es: 'es', fr: 'fr-ca' };

// Redirect /en/* to /* (strip unnecessary English prefix)
app.get('/en', (req, res) => res.redirect(301, '/'));
app.get('/en/*', (req, res) => {
    const stripped = req.path.replace(/^\/en/, '') || '/';
    res.redirect(301, stripped);
});

// Redirect /fr-ca/* to /fr/* (canonical French prefix)
app.get('/fr-ca', (req, res) => res.redirect(301, '/fr'));
app.get('/fr-ca/*', (req, res) => {
    const stripped = req.path.replace(/^\/fr-ca/, '/fr');
    res.redirect(301, stripped);
});

// Locale prefix middleware: detect and strip /es/ prefix before route matching
app.use((req: any, res, next) => {
    const localeMatch = req.path.match(/^\/(es|fr)(\/.*)?$/);
    if (localeMatch) {
        req.localeFromUrl = prefixToLocale[localeMatch[1]];
        req.localePrefix = `/${localeMatch[1]}`;
        const strippedPath = localeMatch[2] || '/';
        const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        req.url = strippedPath + queryString;
    } else {
        req.localeFromUrl = 'en-us';
        req.localePrefix = '';
    }
    next();
});

const renderThoughtView = (req, res, config, {
    markup,
    state,
}, initialState, localeVars) => {
    const title = config.head.title;
    const description = config.head.description
        // eslint-disable-next-line max-len
        || 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.';

    const thoughtId = req.params?.thoughtId;
    const userState = initialState?.user || {};
    const thought = userState?.thoughts?.find((t) => t.id === thoughtId) || null;
    const thoughtTitle = thought?.message ? thought.message.substring(0, 70) : title;
    const thoughtDescription = (thought?.message || description).replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ').substring(0, 300);
    const authorName = thought?.fromUserFirstName && thought?.fromUserLastName
        ? `${thought.fromUserFirstName} ${thought.fromUserLastName}` : '';
    const authorId = thought?.fromUserId || '';
    const thoughtCategory = thought?.category || '';

    const thoughtSchema: any = {
        '@context': 'https://schema.org',
        '@type': 'SocialMediaPosting',
        '@id': `https://www.therr.com${localeVars.canonicalPath}`,
        headline: thoughtTitle,
        datePublished: thought?.createdAt || '',
        author: {
            '@type': 'Person',
            name: authorName,
            url: authorId ? `https://therr.com/users/${authorId}` : '',
        },
    };

    if (thought?.message) {
        thoughtSchema.articleBody = thoughtDescription;
    }

    const breadcrumbItems: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.therr.com/',
        },
        {
            '@type': 'ListItem', position: 2, name: 'Posts', item: 'https://www.therr.com/posts/thoughts',
        },
        { '@type': 'ListItem', position: 3, name: thoughtTitle },
    ];

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    return res.render(config.view, {
        title: thoughtTitle,
        description: thoughtDescription,
        datePublished: thought?.createdAt,
        authorName,
        authorId,
        thoughtCategory,
        thoughtSchema: JSON.stringify(thoughtSchema),
        breadcrumbSchema: JSON.stringify(breadcrumbSchema),
        markup,
        routePath: config.route,
        state,
        ...localeVars,
    });
};

const renderMomentView = (req, res, config, {
    markup,
    state,
}, initialState, localeVars) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    const description = config.head.description
        // eslint-disable-next-line max-len
        || 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.';

    // TODO: Mimic existing best SEO practices for a location page
    const momentId = req.params?.momentId;
    const content = initialState?.content || {};
    const moment = initialState?.map?.moments[momentId];
    const momentTitle = moment ? moment?.notificationMsg : title;
    const momentDescription = (moment?.message || description).replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ').substring(0, 300);
    const authorName = moment?.fromUserFirstName && moment?.fromUserLastName ? `${moment?.fromUserFirstName} ${moment?.fromUserLastName}` : '';
    const authorId = moment?.fromUserId || '';

    let metaImgUrl;

    // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
    const mediaPath = (moment.medias?.[0]?.path);
    const mediaType = (moment.medias?.[0]?.type);
    const momentMediaUri = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri(moment.medias?.[0], 600, 600)
        : content?.media?.[mediaPath];

    if (momentMediaUri) {
        if (momentMediaUri.includes('.jpg') || momentMediaUri.includes('.jpeg') || momentMediaUri.includes('.png')) {
            metaImgUrl = momentMediaUri;
        }
    }

    const momentCategory = moment?.category || '';

    const momentSchema: any = {
        '@context': 'https://schema.org',
        '@type': 'SocialMediaPosting',
        '@id': `https://www.therr.com${localeVars.canonicalPath}`,
        headline: momentTitle,
        datePublished: moment?.createdAt || '',
        dateModified: moment?.updatedAt || moment?.createdAt || '',
        image: metaImgUrl || '',
        author: {
            '@type': 'Person',
            name: authorName,
            url: authorId ? `https://therr.com/users/${authorId}` : '',
        },
    };

    if (moment?.message) {
        momentSchema.articleBody = momentDescription;
    }

    // Breadcrumb schema
    const breadcrumbItems: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.therr.com/',
        },
        {
            '@type': 'ListItem', position: 2, name: 'Moments', item: 'https://www.therr.com/explore',
        },
        { '@type': 'ListItem', position: 3, name: momentTitle },
    ];

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    return res.render(routeView, {
        title: momentTitle,
        description: momentDescription,
        datePublished: moment?.createdAt,
        authorName,
        authorId,
        momentCategory,
        metaImgUrl,
        momentSchema: JSON.stringify(momentSchema),
        breadcrumbSchema: JSON.stringify(breadcrumbSchema),
        markup,
        routePath,
        state,
        ...localeVars,
    });
};

const renderSpaceView = (req, res, config, {
    markup,
    state,
}, initialState, localeVars) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    const description = config.head.description
        // eslint-disable-next-line max-len
        || 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.';

    // TODO: Mimic existing best SEO practices for a location page
    const spaceId = req.params?.spaceId;
    const content = initialState?.content || {};
    const space = initialState?.map?.spaces[spaceId];

    // Return 404 status for missing/deleted spaces so search engines de-index them
    if (!space) {
        return res.status(404).render(routeView, {
            title,
            description,
            markup,
            routePath,
            state,
            ...localeVars,
        });
    }

    // 301 redirect to keyword-rich slug URL if slug is missing or incorrect
    if (space.notificationMsg) {
        const expectedSlug = buildSpaceSlug(space.notificationMsg, space.addressLocality, space.addressRegion);
        const currentSlug = req.params?.spaceSlug || '';
        if (expectedSlug && currentSlug !== expectedSlug) {
            const lp = localeVars.localePrefix;
            return res.redirect(301, `${lp}/spaces/${spaceId}/${expectedSlug}`);
        }
    }

    const spaceNameBase = space.notificationMsg || title;
    const locationParts = [space?.addressLocality, space?.addressRegion].filter(Boolean);
    const spaceTitle = locationParts.length > 0 ? `${spaceNameBase} in ${locationParts.join(', ')}` : spaceNameBase;
    // eslint-disable-next-line prefer-template
    const spaceDescription = `${space?.notificationMsg ? space.notificationMsg + ' - ' : ''}` + (space?.message || description).replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ').substring(0, 300);
    const spacePhoneNumber = space?.phoneNumber || '';
    const spaceCountry = space?.region || '';
    const spaceAddressLocality = space?.addressLocality || '';
    const spaceAddressRegion = space?.addressRegion || '';
    const spaceAddressStreet = space?.addressStreetAddress || '';
    const spacePostalCode = space?.postalCode || '';
    const spaceWebsiteUrl = space?.websiteUrl || '';
    const spacePriceRange = space?.priceRange || 0;
    const spaceFoodGenre = space?.foodStyle || '';

    let metaImgUrl;

    // Collect all public image URLs for schema
    const schemaImages: string[] = [];
    if (space.medias?.length) {
        space.medias.forEach((media) => {
            if (media?.path && media?.type === Content.mediaTypes.USER_IMAGE_PUBLIC) {
                const uri = getUserContentUri(media, 600, 600);
                if (uri && (uri.includes('.jpg') || uri.includes('.jpeg') || uri.includes('.png'))) {
                    schemaImages.push(uri);
                }
            }
        });
    }

    // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
    const mediaPath = (space.medias?.[0]?.path);
    const mediaType = (space.medias?.[0]?.type);
    const spaceMediaUri = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri(space?.medias?.[0], 600, 600)
        : content?.media?.[mediaPath];

    if (spaceMediaUri) {
        if (spaceMediaUri.includes('.jpg') || spaceMediaUri.includes('.jpeg') || spaceMediaUri.includes('.png')) {
            metaImgUrl = spaceMediaUri;
        }
    }

    // Map category to schema.org type
    const categorySchemaMap: { [key: string]: string } = {
        'categories.restaurant/food': 'Restaurant',
        'categories.food': 'Restaurant',
        'categories.menu': 'Restaurant',
        'categories.bar/drinks': 'BarOrNightClub',
        'categories.drinks': 'BarOrNightClub',
        'categories.nightLife': 'BarOrNightClub',
        'categories.hotels/lodging': 'LodgingBusiness',
        'categories.fitness/sports': 'SportsActivityLocation',
        'categories.fitness': 'SportsActivityLocation',
        'categories.sports': 'SportsActivityLocation',
        'categories.storefront/shop': 'Store',
        'categories.storefront': 'Store',
        'categories.museum/academia': 'Museum',
        'categories.event/space': 'EventVenue',
    };
    const schemaType = categorySchemaMap[space?.category] || 'LocalBusiness';

    const spaceLatitude = space?.latitude || '';
    const spaceLongitude = space?.longitude || '';
    const spaceAddressReadable = space?.addressReadable || '';

    const spaceSchema: any = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        name: spaceNameBase,
        image: schemaImages.length > 0 ? schemaImages : (metaImgUrl || ''),
        priceRange: '$'.repeat(spacePriceRange || 2),
        telephone: spacePhoneNumber || '',
        address: {
            '@type': 'PostalAddress',
            streetAddress: spaceAddressStreet,
            addressLocality: spaceAddressLocality,
            addressCountry: spaceCountry,
            addressRegion: spaceAddressRegion,
            postalCode: spacePostalCode,
        },
        url: spaceWebsiteUrl || '',
        servesCuisine: spaceFoodGenre,
    };

    if (space?.menuUrl) {
        spaceSchema.hasMenu = space.menuUrl;
    }

    if (space?.reservationUrl) {
        spaceSchema.acceptsReservations = space.reservationUrl;
    }

    if (spaceLatitude && spaceLongitude) {
        spaceSchema.geo = {
            '@type': 'GeoCoordinates',
            latitude: spaceLatitude,
            longitude: spaceLongitude,
        };
    }

    if (space?.rating?.avgRating) {
        spaceSchema.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: space.rating.avgRating,
            reviewCount: space.rating.totalRatings,
            bestRating: 5,
        };
    }

    spaceSchema.openingHours = space?.openingHours?.schema || [];

    if (space?.reviews) {
        spaceSchema.review = space?.reviews.slice(0, 10).map((review) => ({
            '@type': 'Review',
            author: {
                '@type': 'Person',
                name: review.author,
            },
            datePublished: review.createdAt,
            reviewRating: {
                '@type': 'Rating',
                ratingValue: review.rating,
                bestRating: 5,
            },
            reviewBody: review.text,
        }));
    }

    // Breadcrumb schema
    const breadcrumbLocality = spaceAddressLocality || spaceAddressRegion || '';
    const breadcrumbItems: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.therr.com/',
        },
        {
            '@type': 'ListItem', position: 2, name: 'Locations', item: 'https://www.therr.com/locations',
        },
    ];
    if (breadcrumbLocality) {
        breadcrumbItems.push({
            '@type': 'ListItem',
            position: 3,
            name: breadcrumbLocality,
            item: `https://www.therr.com/locations?locality=${encodeURIComponent(breadcrumbLocality)}`,
        });
        breadcrumbItems.push({ '@type': 'ListItem', position: 4, name: spaceNameBase });
    } else {
        breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: spaceNameBase });
    }

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    // FAQPage schema — auto-generated from structured data
    const faqEntries: { question: string; answer: string }[] = [];
    const spaceNameForFaq = space?.notificationMsg || spaceTitle;

    if (spaceAddressReadable || spaceAddressStreet) {
        faqEntries.push({
            question: `Where is ${spaceNameForFaq} located?`,
            answer: spaceAddressReadable || [spaceAddressStreet, spaceAddressLocality, spaceAddressRegion, spacePostalCode].filter(Boolean).join(', '),
        });
    }

    if (space?.openingHours?.schema?.length) {
        faqEntries.push({
            question: `What are the hours of ${spaceNameForFaq}?`,
            answer: `The hours are: ${space.openingHours.schema.join('; ')}.`,
        });
    }

    if (spaceFoodGenre) {
        faqEntries.push({
            question: `What type of food does ${spaceNameForFaq} serve?`,
            answer: `${spaceNameForFaq} serves ${spaceFoodGenre} cuisine.`,
        });
    }

    if (spacePriceRange) {
        const priceLabel = ['', 'budget-friendly', 'moderate', 'upscale', 'fine dining'][spacePriceRange] || 'moderate';
        faqEntries.push({
            question: `What is the price range at ${spaceNameForFaq}?`,
            answer: `${spaceNameForFaq} is ${priceLabel} (${'$'.repeat(spacePriceRange)}).`,
        });
    }

    if (spacePhoneNumber) {
        faqEntries.push({
            question: `What is the phone number for ${spaceNameForFaq}?`,
            answer: `You can reach ${spaceNameForFaq} at ${spacePhoneNumber}.`,
        });
    }

    let faqSchemaStr = '';
    if (faqEntries.length > 0) {
        const faqSchema = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqEntries.map((entry) => ({
                '@type': 'Question',
                name: entry.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: entry.answer,
                },
            })),
        };
        faqSchemaStr = JSON.stringify(faqSchema);
    }

    return res.render(routeView, {
        title: spaceTitle,
        description: spaceDescription,
        metaImgUrl,
        spaceCountry,
        spacePhoneNumber,
        spaceAddressLocality,
        spaceAddressStreet,
        spaceAddressRegion,
        spacePostalCode,
        spaceWebsiteUrl,
        spacePriceRange,
        spaceLatitude,
        spaceLongitude,
        spaceAddressReadable,
        spaceSchema: JSON.stringify(spaceSchema),
        breadcrumbSchema: JSON.stringify(breadcrumbSchema),
        faqSchema: faqSchemaStr,
        markup,
        routePath,
        state,
        ...localeVars,
    });
};

const renderEventView = (req, res, config, {
    markup,
    state,
}, initialState, localeVars) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    const description = config.head.description
        // eslint-disable-next-line max-len
        || 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.';

    const eventId = req.params?.eventId;
    const content = initialState?.content || {};
    const event = initialState?.map?.events[eventId];
    const eventTitle = event ? event?.notificationMsg : title;
    const eventDescription = (event?.message || description).replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ').substring(0, 300);
    const organizerName = event?.fromUserFirstName && event?.fromUserLastName
        ? `${event?.fromUserFirstName} ${event?.fromUserLastName}` : '';

    let metaImgUrl;

    // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
    const mediaPath = (event?.medias?.[0]?.path);
    const mediaType = (event?.medias?.[0]?.type);
    const eventMediaUri = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri(event?.medias?.[0], 600, 600)
        : content?.media?.[mediaPath];

    if (eventMediaUri) {
        if (eventMediaUri.includes('.jpg') || eventMediaUri.includes('.jpeg') || eventMediaUri.includes('.png')) {
            metaImgUrl = eventMediaUri;
        }
    }

    const eventStartTime = event?.scheduleStartAt || '';
    const eventEndTime = event?.scheduleStopAt || '';
    const eventLatitude = event?.latitude || event?.space?.latitude || '';
    const eventLongitude = event?.longitude || event?.space?.longitude || '';
    const eventAddressReadable = event?.space?.addressReadable || '';

    // schema.org/Event JSON-LD
    const eventSchema: any = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: eventTitle,
        url: `https://www.therr.com${localeVars.canonicalPath}`,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    };

    if (eventDescription) {
        eventSchema.description = eventDescription;
    }
    if (eventStartTime) {
        eventSchema.startDate = eventStartTime;
    }
    if (eventEndTime) {
        eventSchema.endDate = eventEndTime;
    }
    if (event?.updatedAt || event?.createdAt) {
        eventSchema.dateModified = event?.updatedAt || event?.createdAt;
    }
    if (metaImgUrl) {
        eventSchema.image = metaImgUrl;
    }

    // Location from associated space or event lat/lng
    const space = event?.space;
    if (space) {
        eventSchema.location = {
            '@type': 'Place',
            name: space.notificationMsg || '',
            address: {
                '@type': 'PostalAddress',
                streetAddress: space.addressStreetAddress || '',
                addressLocality: space.addressLocality || '',
                addressRegion: space.addressRegion || '',
                postalCode: space.postalCode || '',
                addressCountry: space.region || '',
            },
        };
        if (space.latitude && space.longitude) {
            eventSchema.location.geo = {
                '@type': 'GeoCoordinates',
                latitude: space.latitude,
                longitude: space.longitude,
            };
        }
    } else if (eventLatitude && eventLongitude) {
        eventSchema.location = {
            '@type': 'Place',
            geo: {
                '@type': 'GeoCoordinates',
                latitude: eventLatitude,
                longitude: eventLongitude,
            },
        };
    }

    // Organizer: prefer group, fallback to person
    const groupData = event?.groupId && initialState?.forums?.forumDetails?.[event.groupId];
    if (groupData?.title) {
        eventSchema.organizer = {
            '@type': 'Organization',
            name: groupData.title,
            url: `https://www.therr.com/groups/${event.groupId}`,
        };
    } else if (organizerName) {
        eventSchema.organizer = {
            '@type': 'Person',
            name: organizerName,
            url: event?.fromUserId ? `https://www.therr.com/users/${event.fromUserId}` : '',
        };
    }

    // Breadcrumb schema
    const breadcrumbItems: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.therr.com/',
        },
    ];

    if (groupData?.title) {
        breadcrumbItems.push({
            '@type': 'ListItem', position: 2, name: groupData.title, item: `https://www.therr.com/groups/${event.groupId}`,
        });
        breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: eventTitle });
    } else {
        breadcrumbItems.push({
            '@type': 'ListItem', position: 2, name: 'Locations', item: 'https://www.therr.com/locations',
        });
        breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: eventTitle });
    }

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    return res.render(routeView, {
        title: eventTitle,
        description: eventDescription,
        organizerName,
        metaImgUrl,
        eventStartTime,
        eventEndTime,
        eventLatitude,
        eventLongitude,
        eventAddressReadable,
        eventSchema: JSON.stringify(eventSchema),
        breadcrumbSchema: JSON.stringify(breadcrumbSchema),
        markup,
        routePath,
        state,
        ...localeVars,
    });
};

const renderUserView = (req, res, config, {
    markup,
    state,
}, initialState, localeVars) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    const description = config.head.description
        // eslint-disable-next-line max-len
        || 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.';

    // TODO: Mimic existing best SEO practices for a location page
    const user = initialState?.user?.userInView;
    const userName = user ? `${user.firstName} ${user.lastName}` : '';

    let metaImgUrl;

    // TODO: Use an image optimized for meta image
    if (user?.media?.profilePicture) {
        const url = getUserImageUri({
            details: user,
        });
        if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png')) {
            metaImgUrl = url;
        }
    }

    const userHandle = user?.userName || '';
    const userBio = user?.settingsBio || '';

    // Collect social links for schema sameAs
    const sameAs: string[] = [];
    if (user?.socialSyncs?.tiktok?.link) sameAs.push(user.socialSyncs.tiktok.link);
    if (user?.socialSyncs?.twitter?.link) sameAs.push(user.socialSyncs.twitter.link);
    if (user?.socialSyncs?.youtube?.link) sameAs.push(user.socialSyncs.youtube.link);
    if (user?.socialSyncs?.instagram?.link) sameAs.push(user.socialSyncs.instagram.link);

    const userSchema: any = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: userName,
        url: `https://www.therr.com${localeVars.canonicalPath}`,
    };

    if (metaImgUrl) {
        userSchema.image = metaImgUrl;
    }
    if (userBio) {
        userSchema.description = userBio;
    }
    if (sameAs.length > 0) {
        userSchema.sameAs = sameAs;
    }

    // Breadcrumb schema
    const breadcrumbItems: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.therr.com/',
        },
        {
            '@type': 'ListItem', position: 2, name: 'Users', item: 'https://www.therr.com/explore',
        },
        { '@type': 'ListItem', position: 3, name: userName || title },
    ];

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    return res.render(routeView, {
        title: userName || title,
        description: userBio || description,
        userHandle,
        metaImgUrl,
        userSchema: JSON.stringify(userSchema),
        breadcrumbSchema: JSON.stringify(breadcrumbSchema),
        markup,
        routePath,
        state,
        ...localeVars,
    });
};

const formatCategoryLabel = (categoryKey: string): string => {
    if (!categoryKey) return '';
    const label = categoryKey.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const renderLocationsView = (req, res, config, {
    markup,
    state,
}, initialState, localeVars) => {
    const routePath = config.route;
    const routeView = config.view;
    const defaultDescription = 'Browse local businesses, restaurants, bars, shops, and events near you. Read reviews, see hours, and get directions.';

    const searchQuery = req.query?.q || '';
    const hasCoords = req.query?.lat && req.query?.lng;

    // Category slug support for dedicated landing pages (e.g. /locations/restaurants)
    const categorySlug = req.params?.categorySlug || '';
    const categoryKey = categorySlug ? Categories.SlugToCategoryMap[categorySlug] : '';
    const categoryLabel = categoryKey ? formatCategoryLabel(categoryKey) : '';

    // Dynamic title/description based on category or search query
    let title: string;
    let description: string;
    if (categoryLabel) {
        title = `Best ${categoryLabel} Near You | Therr`;
        description = `Find the best ${categoryLabel.toLowerCase()} near you. Browse listings, read reviews, see hours, and get directions on Therr.`;
    } else if (searchQuery) {
        title = `Spaces near ${searchQuery} - ${config.head.title}`;
        // eslint-disable-next-line max-len
        description = `Discover local businesses, restaurants, and events near ${searchQuery}. Browse listings, read reviews, and get directions on Therr.`;
    } else {
        title = config.head.title;
        description = config.head.description || defaultDescription;
    }

    const spaces = initialState?.map?.searchResults || [];
    const pageNumber = parseInt(req.params?.pageNumber, 10) || 1;

    // Build base path for pagination links (category-aware)
    const locationsBase = categorySlug ? `/locations/${categorySlug}` : '/locations';

    // Build query string for pagination links (preserve search params)
    const paginationQueryParts: string[] = [];
    if (searchQuery) paginationQueryParts.push(`q=${encodeURIComponent(searchQuery)}`);
    if (hasCoords) {
        paginationQueryParts.push(`lat=${req.query.lat}`);
        paginationQueryParts.push(`lng=${req.query.lng}`);
        if (req.query.r) paginationQueryParts.push(`r=${req.query.r}`);
    }
    const paginationQs = paginationQueryParts.length > 0 ? `?${paginationQueryParts.join('&')}` : '';

    // ItemList schema from prefetched spaces (include keyword-rich slugs in URLs)
    const lp = localeVars.localePrefix;
    const itemListElements = spaces.slice(0, 50).map((space: any, index: number) => {
        const slug = buildSpaceSlug(space.notificationMsg, space.addressLocality, space.addressRegion);
        return {
            '@type': 'ListItem',
            position: index + 1,
            url: `https://www.therr.com${lp}/spaces/${space.id}${slug ? `/${slug}` : ''}`,
            name: space.notificationMsg || space.id,
        };
    });

    let itemListName = 'Business Locations on Therr';
    if (categoryLabel) {
        itemListName = `${categoryLabel} on Therr`;
    } else if (searchQuery) {
        itemListName = `Spaces near ${searchQuery}`;
    }
    const itemListSchema: any = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: itemListName,
        numberOfItems: itemListElements.length,
        itemListElement: itemListElements,
    };

    // SearchAction schema
    const searchActionSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        url: 'https://www.therr.com',
        potentialAction: {
            '@type': 'SearchAction',
            target: 'https://www.therr.com/locations?q={search_term_string}',
            'query-input': 'required name=search_term_string',
        },
    };

    // Geographic structured data for local directory SEO
    const geoSpaces = spaces.filter((s: any) => s.latitude && s.longitude).slice(0, 20);
    const localBusinessSchemas = geoSpaces.map((space: any) => {
        const slug = buildSpaceSlug(space.notificationMsg, space.addressLocality, space.addressRegion);
        return {
            '@type': 'LocalBusiness',
            name: space.notificationMsg || space.id,
            url: `https://www.therr.com${lp}/spaces/${space.id}${slug ? `/${slug}` : ''}`,
            ...(space.addressReadable && { address: space.addressReadable }),
            geo: {
                '@type': 'GeoCoordinates',
                latitude: space.latitude,
                longitude: space.longitude,
            },
        };
    });

    let collectionName = 'Local Business Directory';
    if (categoryLabel) {
        collectionName = `${categoryLabel} Directory`;
    } else if (searchQuery) {
        collectionName = `Local Businesses near ${searchQuery}`;
    }
    const localDirectorySchema = localBusinessSchemas.length > 0
        ? {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: collectionName,
            description,
            ...(hasCoords && {
                spatialCoverage: {
                    '@type': 'Place',
                    geo: {
                        '@type': 'GeoCoordinates',
                        latitude: parseFloat(req.query.lat),
                        longitude: parseFloat(req.query.lng),
                    },
                },
            }),
            mainEntity: {
                '@type': 'ItemList',
                itemListElement: localBusinessSchemas.map((biz: any, i: number) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    item: biz,
                })),
            },
        }
        : null;

    // Breadcrumb schema (category-aware)
    const breadcrumbItems: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.therr.com/',
        },
        {
            '@type': 'ListItem', position: 2, name: 'Locations', item: 'https://www.therr.com/locations',
        },
    ];
    if (categoryLabel) {
        breadcrumbItems.push({
            '@type': 'ListItem', position: 3, name: categoryLabel, item: `https://www.therr.com/locations/${categorySlug}`,
        });
    } else if (searchQuery) {
        breadcrumbItems.push({
            '@type': 'ListItem', position: 3, name: searchQuery,
        });
    }

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    // Pagination links (include locale prefix, category slug, and search params)
    const prevPage = pageNumber > 1
        ? `${lp}${locationsBase}${pageNumber > 2 ? `/${pageNumber - 1}` : ''}${paginationQs}`
        : '';
    const nextPage = spaces.length > 0 ? `${lp}${locationsBase}/${pageNumber + 1}${paginationQs}` : '';

    return res.render(routeView, {
        title,
        description,
        itemListSchema: JSON.stringify(itemListSchema),
        searchActionSchema: JSON.stringify(searchActionSchema),
        breadcrumbSchema: JSON.stringify(breadcrumbSchema),
        localDirectorySchema: localDirectorySchema ? JSON.stringify(localDirectorySchema) : '',
        prevPage,
        nextPage,
        markup,
        routePath,
        state,
        ...localeVars,
    });
};

const renderGroupView = (req, res, config, {
    markup,
    state,
}, initialState, localeVars) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    const description = config.head.description
        // eslint-disable-next-line max-len
        || 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.';

    const groupId = req.params?.groupId;
    const group = initialState?.forums?.forumDetails?.[groupId];
    const groupTitle = group ? group?.title : title;
    const groupDescription = (group?.description || description).replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ').substring(0, 300);

    let metaImgUrl;

    const mediaPath = group?.media?.[0]?.path;
    const mediaType = group?.media?.[0]?.type;
    const groupMediaUri = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri(group?.media?.[0], 600, 600)
        : undefined;

    if (groupMediaUri) {
        if (groupMediaUri.includes('.jpg') || groupMediaUri.includes('.jpeg') || groupMediaUri.includes('.png')) {
            metaImgUrl = groupMediaUri;
        }
    }

    // schema.org/Organization JSON-LD
    const groupSchema: any = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: groupTitle,
        url: `https://www.therr.com${localeVars.canonicalPath}`,
    };

    if (groupDescription) {
        groupSchema.description = groupDescription;
    }
    if (metaImgUrl) {
        groupSchema.image = metaImgUrl;
    }

    if (group?.events?.length) {
        groupSchema.event = group.events.map((event: any) => {
            const eventEntry: any = {
                '@type': 'Event',
                name: event.notificationMsg || event.title,
                url: `https://www.therr.com/events/${event.id}`,
            };
            if (event.scheduleStartAt) {
                eventEntry.startDate = event.scheduleStartAt;
            }
            return eventEntry;
        });
    }

    // Breadcrumb schema
    const breadcrumbItems: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.therr.com/',
        },
        {
            '@type': 'ListItem', position: 2, name: 'Groups', item: 'https://www.therr.com/groups',
        },
        { '@type': 'ListItem', position: 3, name: groupTitle },
    ];

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    return res.render(routeView, {
        title: groupTitle,
        description: groupDescription,
        metaImgUrl,
        groupSchema: JSON.stringify(groupSchema),
        breadcrumbSchema: JSON.stringify(breadcrumbSchema),
        markup,
        routePath,
        state,
        ...localeVars,
    });
};

const renderInviteView = (req, res, config, {
    markup,
    state,
}, localeVars) => {
    const routePath = config.route;
    const routeView = config.view;
    const rawUsername = req.params?.username || '';
    const username = rawUsername.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
    const title = `Join ${username} on Therr App`;
    const description = `Join the local community & rewards app. Sign up with ${username}'s invite and you both earn rewards!`;

    return res.render(routeView, {
        title,
        description,
        markup,
        routePath,
        state,
        ...localeVars,
    });
};

// Locale detection for SSR
const localeMap: Record<string, { htmlLang: string; ogLocale: string }> = {
    'en-us': { htmlLang: 'en-US', ogLocale: 'en_US' },
    es: { htmlLang: 'es-MX', ogLocale: 'es_MX' },
    'fr-ca': { htmlLang: 'fr-CA', ogLocale: 'fr_CA' },
};

const getLocaleVars = (req: any) => {
    // URL prefix is the source of truth for page locale
    const locale = req.localeFromUrl || 'en-us';
    const { htmlLang, ogLocale } = localeMap[locale] || localeMap['en-us'];
    const basePath = req.path; // stripped path (no locale prefix)
    const localePrefix = req.localePrefix || '';

    // Canonical URL uses the current locale's full path
    let canonicalPath = basePath;
    if (localePrefix) {
        canonicalPath = basePath === '/' ? localePrefix : `${localePrefix}${basePath}`;
    }
    // hreflang links: English = unprefixed, Spanish = /es prefixed, French = /fr prefixed
    const hreflangEn = basePath;
    const hreflangEs = basePath === '/' ? '/es' : `/es${basePath}`;
    const hreflangFr = basePath === '/' ? '/fr' : `/fr${basePath}`;

    return {
        htmlLang,
        ogLocale,
        canonicalPath,
        hreflangEn,
        hreflangEs,
        hreflangFr,
        localePrefix,
        googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION || '',
        bingSiteVerification: process.env.BING_SITE_VERIFICATION || '',
        pinterestVerification: process.env.PINTEREST_VERIFICATION || '',
    };
};

// ── Cloudflare CDN cache headers for SSR pages ──
// Public, crawlable pages get edge-cached (s-maxage) with short browser cache (max-age).
// stale-while-revalidate lets the CDN serve stale content while fetching a fresh copy.
// Auth-dependent / private pages are never cached at the CDN.
const publicRoutePatterns = [
    /^\/$/,
    /^\/login$/,
    /^\/register$/,
    /^\/locations(\/\d+)?$/,
    /^\/locations\/[a-z-]+(\/\d+)?$/,
    /^\/spaces\/[^/]+$/,
    /^\/spaces\/[^/]+\/[^/]+$/,
    /^\/events\/[^/]+$/,
    /^\/groups(\/[^/]+)?$/,
    /^\/moments\/[^/]+$/,
    /^\/thoughts\/[^/]+$/,
    /^\/users\/[^/]+$/,
    /^\/invite\/[^/]+$/,
    /^\/child-safety$/,
    /^\/go-mobile$/,
    /^\/app-feedback$/,
    /^\/reset-password$/,
    /^\/verify-account$/,
];

const isPublicRoute = (pathname: string): boolean => publicRoutePatterns.some((re) => re.test(pathname));

app.use((req: any, res, next) => {
    // Skip static assets — expressStaticGzip sets its own headers
    // Skip sitemap/robots/healthcheck endpoints — they set their own headers
    if (req.path.match(/\.(js|css|map|br|gz|ico|png|jpg|jpeg|svg|webp|woff2?|ttf|eot|txt|xml)$/)) {
        return next();
    }

    const strippedPath = req.path; // locale prefix already stripped by earlier middleware

    if (isPublicRoute(strippedPath)) {
        // CDN caches for 5 min, browser caches for 60s, serve stale up to 10 min while revalidating
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    } else {
        // Private/auth pages: never cache at CDN or browser
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('CDN-Cache-Control', 'no-store');
    }

    next();
});

// Universal routing and rendering for SEO
routeConfig.forEach((config) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    const description = config.head.description
    || 'A nearby newsfeed app & social network that allows connections through the space around us. Users and local businesses creating authentic connections.';

    app.get(routePath, (req: any, res) => {
        const colorScheme = (req.headers.cookie?.match(/therr-color-scheme=(light|dark)/)?.[1] || 'light') as 'light' | 'dark';
        const promises: any = [];
        const staticContext: any = {};
        const urlLocale = req.localeFromUrl || 'en-us';
        const initialState: any = {
            user: {
                details: {},
                settings: {
                    locale: urlLocale,
                },
            },
        };
        const store = configureStore({
            reducer: rootReducer,
            preloadedState: initialState,
            middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(socketIOMiddleWare),
        });

        getRoutes({
            isAuthorized: () => true, // This is a noop since we don't need to check auth in order to fetch data
        }).some((route: IRoute) => {
            const match = matchPath(route.path, req.path);
            if (match && route.fetchData) {
                const Comp = route.element;
                const initData = (Comp && route.fetchData) || (() => Promise.resolve());
                // fetchData calls a dispatch on the store updating the current state before render
                promises.push(initData(store.dispatch, match.params, req.query)
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

        Promise.all(promises).then(() => {
            const localePrefix = req.localePrefix || '';
            const envVars = globalConfig[process.env.NODE_ENV] || globalConfig.production;
            const markup = ReactDOMServer.renderToString(
                <GoogleOAuthProvider clientId={envVars.googleOAuth2WebClientId}>
                    <MantineProvider theme={mantineTheme} defaultColorScheme={colorScheme}>
                        <Provider store={store}>
                            <StaticRouter location={req.url} basename={localePrefix || undefined}>
                                <Layout />
                            </StaticRouter>
                        </Provider>
                    </MantineProvider>
                </GoogleOAuthProvider>,
            );

            // This gets the initial state created after all dispatches are called in fetchData
            Object.assign(initialState, store.getState());

            // TODO: Handle all parsing edge cases
            // https://github.com/yahoo/serialize-javascript ?
            const state = serialize(initialState, {
                isJSON: true,
            }).replace(/</g, '\\u003c').replace(/\\n/g, ' ').replace(/\\r/g, ' ');

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
                const localeVars = getLocaleVars(req);

                if (routeView === 'thoughts') {
                    return renderThoughtView(req, res, config, {
                        markup,
                        state,
                    }, initialState, localeVars);
                }

                if (routeView === 'moments') {
                    return renderMomentView(req, res, config, {
                        markup,
                        state,
                    }, initialState, localeVars);
                }

                if (routeView === 'locations') {
                    return renderLocationsView(req, res, config, {
                        markup,
                        state,
                    }, initialState, localeVars);
                }

                if (routeView === 'groups') {
                    return renderGroupView(req, res, config, {
                        markup,
                        state,
                    }, initialState, localeVars);
                }

                if (routeView === 'events') {
                    return renderEventView(req, res, config, {
                        markup,
                        state,
                    }, initialState, localeVars);
                }

                if (routeView === 'spaces') {
                    return renderSpaceView(req, res, config, {
                        markup,
                        state,
                    }, initialState, localeVars);
                }

                if (routeView === 'users') {
                    return renderUserView(req, res, config, {
                        markup,
                        state,
                    }, initialState, localeVars);
                }

                if (routeView === 'invite') {
                    return renderInviteView(req, res, config, {
                        markup,
                        state,
                    }, localeVars);
                }

                return res.render(routeView, {
                    title,
                    description,
                    markup,
                    routePath,
                    state,
                    ...localeVars,
                });
            }
        }).catch((err) => {
            console.log(err);
        });
    });
});

// Start the server
const port = process.env.CLIENT_PORT;
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
            port: process.env.CLIENT_PORT,
            processId: process.pid,
            isUncaughtException: true,
            errorMessage: err?.message,
            errorOrigin: origin,
            source: origin,
        },
    });
});
