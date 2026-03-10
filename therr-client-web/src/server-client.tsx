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
import ReactGA from 'react-ga4';
import LogRocket from 'logrocket';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import printLogs from 'therr-js-utilities/print-logs';
import serialize from 'serialize-javascript';
import { BrandVariations, Content } from 'therr-js-utilities/constants';
import routeConfig from './routeConfig';
import rootReducer from './redux/reducers';
import socketIOMiddleWare from './socket-io-middleware';
import getUserImageUri from './utilities/getUserImageUri';
import * as globalConfig from '../../global-config';
import getUserContentUri from './utilities/getUserContentUri';

axios.defaults.baseURL = globalConfig[process.env.NODE_ENV].baseApiGatewayRoute;
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

// Enable gzip/deflate compression for all responses
app.use(compression());

if (process.env.NODE_ENV !== 'development') {
    app.use(helmet({
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
                ],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    'https://*.googletagmanager.com',
                    'https://*.google-analytics.com',
                    'https://cdn.lr-in-prod.com',
                    'https://cdn.lr-ingest.com',
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    'https://fonts.googleapis.com',
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

// Dynamic sitemap with cached space URLs
let sitemapCache: { xml: string; timestamp: number } | null = null;
const SITEMAP_CACHE_TTL = 60 * 60 * 1000; // 1 hour

app.get('/sitemap.xml', async (req, res) => {
    const now = Date.now();
    if (sitemapCache && (now - sitemapCache.timestamp) < SITEMAP_CACHE_TTL) {
        res.set('Content-Type', 'application/xml');
        return res.send(sitemapCache.xml);
    }

    const staticUrls = [
        { loc: '/', priority: '1.0' },
        { loc: '/login', priority: '0.8' },
        { loc: '/register', priority: '0.8' },
        { loc: '/locations', priority: '0.9' },
    ];

    let spaceUrls: { loc: string; lastmod: string }[] = [];

    try {
        const response = await axios.post('/maps-service/spaces/list?itemsPerPage=1000&pageNumber=1', {
            distanceOverride: 40075 * (1000 / 2),
        });
        const spaces = response?.data?.results || [];
        spaceUrls = spaces.map((space: any) => ({
            loc: `/spaces/${space.id}`,
            lastmod: space.updatedAt ? new Date(space.updatedAt).toISOString().split('T')[0] : '',
        }));
    } catch (err) {
        printLogs({
            level: 'error',
            messageOrigin: 'SERVER_CLIENT',
            messages: 'Failed to fetch spaces for sitemap',
            tracer: beeline,
            traceArgs: { errorMessage: (err as any)?.message },
        });
    }

    const today = new Date().toISOString().split('T')[0];

    // eslint-disable-next-line max-len
    const buildUrl = (loc: string, lastmod: string, priority: string) => `  <url>\n    <loc>https://www.therr.com${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;

    const urls = [
        ...staticUrls.map((u) => buildUrl(u.loc, today, u.priority)),
        ...spaceUrls.map((u) => buildUrl(u.loc, u.lastmod || today, '0.7')),
    ];

    // eslint-disable-next-line max-len
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

    sitemapCache = { xml, timestamp: now };
    res.set('Content-Type', 'application/xml');
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

const renderMomentView = (req, res, config, {
    markup,
    state,
}, initialState) => {
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
        ? getUserContentUri(moment.medias[0])
        : content?.media?.[mediaPath];

    // TODO: Use an image optimized for meta image
    if (momentMediaUri) {
        if (momentMediaUri.includes('.jpg') || momentMediaUri.includes('.jpeg') || momentMediaUri.includes('.png')) {
            metaImgUrl = momentMediaUri;
        }
    }

    const momentCategory = moment?.category || '';

    const momentSchema: any = {
        '@context': 'https://schema.org',
        '@type': 'SocialMediaPosting',
        '@id': `https://www.therr.com${req.path}`,
        headline: momentTitle,
        datePublished: moment?.createdAt || '',
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
        { '@type': 'ListItem', position: 2, name: 'Moments' },
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
        requestPath: req.path,
        routePath,
        state,
    });
};

const renderSpaceView = (req, res, config, {
    markup,
    state,
}, initialState) => {
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
    const spaceNameBase = space ? space?.notificationMsg : title;
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

    // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
    const mediaPath = (space.medias?.[0]?.path);
    const mediaType = (space.medias?.[0]?.type);
    const spaceMediaUri = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri(space?.medias[0])
        : content?.media?.[mediaPath];

    // TODO: Use an image optimized for meta image (ImageKit)
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
        name: spaceTitle,
        image: metaImgUrl || '',
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
            author: review.author,
            datePublished: review.createdAt,
            reviewRating: {
                ratingValue: review.rating,
            },
            description: review.text,
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
        breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: breadcrumbLocality });
        breadcrumbItems.push({ '@type': 'ListItem', position: 4, name: spaceTitle });
    } else {
        breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: spaceTitle });
    }

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

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
        markup,
        requestPath: req.path,
        routePath,
        state,
    });
};

const renderUserView = (req, res, config, {
    markup,
    state,
}, initialState) => {
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
        url: `https://www.therr.com${req.path}`,
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
        { '@type': 'ListItem', position: 2, name: 'Users' },
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
        requestPath: req.path,
        routePath,
        state,
    });
};

const renderLocationsView = (req, res, config, {
    markup,
    state,
}, initialState) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    const description = config.head.description
        // eslint-disable-next-line max-len
        || 'Browse local businesses, restaurants, bars, shops, and events near you. Read reviews, see hours, and get directions.';

    const spaces = initialState?.map?.searchResults || [];
    const pageNumber = parseInt(req.params?.pageNumber, 10) || 1;

    // ItemList schema from prefetched spaces
    const itemListElements = spaces.slice(0, 50).map((space: any, index: number) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://www.therr.com/spaces/${space.id}`,
        name: space.notificationMsg || space.id,
    }));

    const itemListSchema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Business Locations on Therr',
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

    // Breadcrumb schema
    const breadcrumbItems: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.therr.com/',
        },
        { '@type': 'ListItem', position: 2, name: 'Locations' },
    ];

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    // Pagination links
    const prevPage = pageNumber > 1 ? `/locations${pageNumber > 2 ? `/${pageNumber - 1}` : ''}` : '';
    const nextPage = spaces.length > 0 ? `/locations/${pageNumber + 1}` : '';

    return res.render(routeView, {
        title,
        description,
        itemListSchema: JSON.stringify(itemListSchema),
        searchActionSchema: JSON.stringify(searchActionSchema),
        breadcrumbSchema: JSON.stringify(breadcrumbSchema),
        prevPage,
        nextPage,
        markup,
        requestPath: req.path,
        routePath,
        state,
    });
};

const renderInviteView = (req, res, config, {
    markup,
    state,
}) => {
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
        requestPath: req.path,
        routePath,
        state,
    });
};

// TODO: Add cookie-based locale detection for SSR (e.g., read 'therr-locale' cookie).
// For now, SSR defaults to 'en-us' and the client hydrates with the correct locale from Redux.

// Universal routing and rendering for SEO
routeConfig.forEach((config) => {
    const routePath = config.route;
    const routeView = config.view;
    const title = config.head.title;
    const description = config.head.description
    || 'A nearby newsfeed app & social network that allows connections through the space around us. Users and local businesses creating authentic connections.';

    app.get(routePath, (req, res) => {
        const colorScheme = (req.headers.cookie?.match(/therr-color-scheme=(light|dark)/)?.[1] || 'light') as 'light' | 'dark';
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

        Promise.all(promises).then(() => {
            const markup = ReactDOMServer.renderToString(
                <MantineProvider theme={mantineTheme} defaultColorScheme={colorScheme}>
                    <Provider store={store}>
                        <StaticRouter location={req.url}>
                            <Layout />
                        </StaticRouter>
                    </Provider>
                </MantineProvider>,
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
                ReactGA.send({ hitType: 'pageview', page: req.path, title });

                if (routeView === 'moments') {
                    return renderMomentView(req, res, config, {
                        markup,
                        state,
                    }, initialState);
                }

                if (routeView === 'locations') {
                    return renderLocationsView(req, res, config, {
                        markup,
                        state,
                    }, initialState);
                }

                if (routeView === 'spaces') {
                    return renderSpaceView(req, res, config, {
                        markup,
                        state,
                    }, initialState);
                }

                if (routeView === 'users') {
                    return renderUserView(req, res, config, {
                        markup,
                        state,
                    }, initialState);
                }

                if (routeView === 'invite') {
                    return renderInviteView(req, res, config, {
                        markup,
                        state,
                    });
                }

                return res.render(routeView, {
                    title,
                    description,
                    markup,
                    requestPath: req.path,
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
