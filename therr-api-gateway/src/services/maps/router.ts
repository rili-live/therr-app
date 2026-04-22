import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AccessLevels } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import {
    createCheckInLimiter,
    createActivityLimiter,
    createEventLimiter,
    createMomentLimiter,
    createSpaceLimiter,
    pairingFeedbackLimiter,
    placesApiLimiter,
    geocodeApiLimiter,
} from './limitation/map';
import { createCheckInValidation, getSignedUrlValidation } from './validation';
import {
    createAreaValidation,
    updateAreaValidation,
    searchAreasValidation,
    searchMyAreasValidation,
    deleteAreasValidation,
} from './validation/areas';
import {
    createIntegratedMomentValidation,
    dynamicCreateIntegratedMomentValidation,
    getMomentDetailsValidation,
} from './validation/moments';
import {
    getSpaceDetailsValidation,
    getSpacePairingsValidation,
    updateSpaceValidation,
    submitPairingFeedbackValidation,
} from './validation/spaces';
import CacheStore from '../../store';
import authenticateOptional from '../../middleware/authenticateOptional';
import authorize, { AccessCheckType } from '../../middleware/authorize';
import { createEventValidations, getEventDetailsValidation } from './validation/events';
import { createActivityValidations } from './validation/activities';

const mapsServiceRouter = express.Router();

// Media
mapsServiceRouter.post('/media/signed-urls', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

// Activities
mapsServiceRouter.get('/activities/connections', createActivityLimiter, createActivityValidations, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));
mapsServiceRouter.post('/activities/generate', createActivityLimiter, createActivityValidations, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

// Events
// Limited to prevent abuse
mapsServiceRouter.post('/events', createEventLimiter, createEventValidations, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.put('/events/:eventId', updateAreaValidation, validate, async (req, res, next) => {
    await CacheStore.mapsService.invalidateAreaDetails('events', req.params.eventId);

    if (req.body.spaceId) {
        CacheStore.mapsService.invalidateAreaDetails('spaces', req.body.spaceId);
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'put',
}));

mapsServiceRouter.post('/events/:eventId/details', authenticateOptional, getEventDetailsValidation, validate, async (req, res, next) => {
    const eventDetails = await CacheStore.mapsService.getAreaDetails('events', req.params.eventId);

    if (eventDetails) {
        return res.status(200).send({ ...eventDetails, cached: true });
    }

    if (req.body.spaceId) {
        CacheStore.mapsService.invalidateAreaDetails('spaces', req.body.spaceId);
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}, (response, reqBody) => {
    if (reqBody.withMedia && reqBody.withUser) {
        return CacheStore.mapsService.setAreaDetails('events', response);
    }
}));

mapsServiceRouter.post('/events/search', authenticateOptional, searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/events/search/me', searchMyAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/events/search/for-space-ids', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.get('/events/signed-url/public', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.get('/events/signed-url/private', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.delete('/events', deleteAreasValidation, validate, (req, res, next) => {
    // TODO: Invalidate spaces since events are listed on spaces
    // OR load space events from a separate endpoint
    (req.body?.ids || []).forEach((id) => {
        CacheStore.mapsService.invalidateAreaDetails('events', id);
    });

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
}));

// Moments
// Limited to prevent abuse
// TODO: We should add backend logic to ensure user location isn't being spoofed (rapidly changing location)
mapsServiceRouter.post('/moments', createMomentLimiter, createAreaValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/integrated', createIntegratedMomentValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/integrated/dynamic', dynamicCreateIntegratedMomentValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.put('/moments/:momentId', updateAreaValidation, validate, async (req, res, next) => {
    await CacheStore.mapsService.invalidateAreaDetails('moments', req.params.momentId);

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'put',
}));

mapsServiceRouter.get('/moments/integrated/:userId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.post('/moments/:momentId/details', authenticateOptional, getMomentDetailsValidation, validate, async (req, res, next) => {
    const momentDetails = await CacheStore.mapsService.getAreaDetails('moments', req.params.momentId);

    if (momentDetails) {
        return res.status(200).send({ ...momentDetails, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}, (response, reqBody) => {
    if (reqBody.withMedia && reqBody.withUser) {
        return CacheStore.mapsService.setAreaDetails('moments', response);
    }
}));

mapsServiceRouter.post('/moments/search', authenticateOptional, searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/search/me', searchMyAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/search/for-space-ids', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.get('/moments/signed-url/public', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.get('/moments/signed-url/private', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.delete('/moments', deleteAreasValidation, validate, (req, res, next) => {
    (req.body?.ids || []).forEach((id) => {
        CacheStore.mapsService.invalidateAreaDetails('moments', id);
    });

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
}));

// Spaces
mapsServiceRouter.post('/spaces', createSpaceLimiter, createAreaValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.put('/spaces/:spaceId', updateSpaceValidation, validate, async (req, res, next) => {
    await CacheStore.mapsService.invalidateAreaDetails('spaces', req.params.spaceId);

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'put',
}));

// Space Pairings
mapsServiceRouter.get('/spaces/:spaceId/pairings', authenticateOptional, getSpacePairingsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.post(
    '/spaces/:spaceId/pairings/feedback',
    pairingFeedbackLimiter,
    authenticateOptional,
    submitPairingFeedbackValidation,
    validate,
    handleServiceRequest({
        basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
        method: 'post',
    }),
);

mapsServiceRouter.post('/spaces/:spaceId/details', authenticateOptional, getSpaceDetailsValidation, validate, async (req, res, next) => {
    const spaceDetails = await CacheStore.mapsService.getAreaDetails('spaces', req.params.spaceId);

    if (spaceDetails) {
        return res.status(200).send({ ...spaceDetails, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}, (response, reqBody) => {
    if (reqBody.withMedia && reqBody.withUser) {
        return CacheStore.mapsService.setAreaDetails('spaces', response);
    }
}));

// Public version of search
mapsServiceRouter.post('/spaces/list', searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/spaces/search', authenticateOptional, searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/spaces/search/me', searchMyAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.get('/spaces/signed-url/public', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.get('/spaces/signed-url/private', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.delete('/spaces', deleteAreasValidation, validate, (req, res, next) => {
    (req.body?.ids || []).forEach((id) => {
        CacheStore.mapsService.invalidateAreaDetails('spaces', id);
    });

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
}));

// Space Metrics
// Limited to prevent abuse
// TODO: We should add backend logic to ensure user location isn't being spoofed (rapidly changing location)
mapsServiceRouter.post('/space-metrics/check-in', createMomentLimiter, createCheckInLimiter, createCheckInValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));
mapsServiceRouter.get('/space-metrics/:spaceId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));
mapsServiceRouter.get('/space-metrics/:spaceId/engagement', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

// Dashboard
mapsServiceRouter.post('/spaces/request-claim', createAreaValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));
mapsServiceRouter.post('/spaces/request-claim/:spaceId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));
mapsServiceRouter.post('/spaces/request-approve/:spaceId', validate, authorize(
    {
        type: AccessCheckType.ALL,
        levels: [
            AccessLevels.SUPER_ADMIN,
        ],
    },
), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

// City Pulse — editorial + Therr-data aggregate used by the /locations/city/:slug SSR page.
// Public endpoint (no auth required); cached in Redis for 15 minutes per (slug, locale).
//
// Both the gateway and the maps-service handler normalize locale identically
// (exact-match against the supported set, else fall back to "en-us"), so the
// key we read from matches `response.locale` we write under.
const SUPPORTED_PULSE_LOCALES = ['en-us', 'es', 'fr-ca'];
const normalizePulseLocale = (raw: unknown): string => {
    const value = Array.isArray(raw) ? raw[0] : raw;
    const str = typeof value === 'string' ? value : '';
    return SUPPORTED_PULSE_LOCALES.includes(str) ? str : 'en-us';
};

mapsServiceRouter.get('/cities/:slug/pulse', authenticateOptional, async (req: any, res, next) => {
    const { slug } = req.params;
    const locale = normalizePulseLocale(req.query?.locale || req.headers['x-localecode']);

    const cached = await CacheStore.mapsService.getCityPulse(slug, locale);

    if (cached) {
        return res.status(200).send({ ...cached, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}, (response) => {
    // maps-service's response body carries a normalized `locale`. Cache under it.
    // Use a shorter TTL when wiki content is still empty (cold cache, background
    // refresh in flight) so users get the editorial layer within minutes, not
    // at the end of a full 15-minute window.
    if (response?.city?.slug && response?.locale) {
        const hasWiki = !!(response.wiki?.summary);
        const ttl = hasWiki ? 900 : 120; // 15 min normal, 2 min when wiki is still loading
        return CacheStore.mapsService.setCityPulse(
            response.city.slug,
            response.locale,
            response,
            ttl,
        );
    }
    return undefined;
}));

// External APIs - Nominatim geocoding proxy with rate limiting and caching
mapsServiceRouter.get('/geocode', geocodeApiLimiter, async (req, res) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || !q.trim()) {
        return res.status(400).json({ message: 'Query parameter "q" is required' });
    }

    const cacheKey = crypto.createHash('sha256').update(`geocode:${q.trim().toLowerCase()}`).digest('hex');
    const cached = await CacheStore.mapsService.getGeocodingResponse(cacheKey);

    if (cached) {
        return res.status(200).json(cached);
    }

    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: q.trim(),
                format: 'json',
                limit: 1,
                addressdetails: 1,
            },
            headers: {
                'User-Agent': 'Therr App (https://www.therr.com)',
            },
            timeout: 5000,
        });

        const results = response.data;

        if (!results || results.length === 0) {
            const emptyData = { results: [] };
            // Cache empty results too (shorter TTL) to avoid re-fetching gibberish queries
            CacheStore.mapsService.setGeocodingResponse(cacheKey, emptyData);
            return res.status(200).json(emptyData);
        }

        const result = results[0];
        const data = {
            results: [{
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                displayName: result.display_name,
                boundingBox: result.boundingbox?.map(parseFloat) || [],
                type: result.type,
                class: result.class,
            }],
        };

        CacheStore.mapsService.setGeocodingResponse(cacheKey, data);

        return res.status(200).json(data);
    } catch (err) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_GATEWAY_MAPS_ROUTER',
            messages: ['Geocoding proxy error'],
            traceArgs: { 'error.message': err instanceof Error ? err.message : String(err) },
        });
        return res.status(502).json({ message: 'Geocoding service unavailable' });
    }
});

// External APIs - Mapbox Search proxy with rate limiting and caching
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';

mapsServiceRouter.get('/mapbox/search', placesApiLimiter, async (req, res) => {
    const {
        q, latitude, longitude, limit: resultLimit, language, sessionToken,
    } = req.query;

    if (!q || typeof q !== 'string' || !q.trim()) {
        return res.status(400).json({ message: 'Query parameter "q" is required' });
    }

    if (!MAPBOX_ACCESS_TOKEN) {
        return res.status(503).json({ message: 'Mapbox search is not configured' });
    }

    const cacheKey = crypto.createHash('sha256').update(
        `mapbox:${q.trim().toLowerCase()}:${latitude}:${longitude}:${language || 'en'}`,
    ).digest('hex');
    const cached = await CacheStore.mapsService.getPlacesResponse(cacheKey);

    if (cached) {
        return res.status(200).json(cached);
    }

    try {
        const params: Record<string, string> = {
            q: q.trim(),
            access_token: MAPBOX_ACCESS_TOKEN,
            limit: String(resultLimit || 5),
            language: String(language || 'en'),
        };

        if (latitude && longitude) {
            params.proximity = `${longitude},${latitude}`;
        }

        if (sessionToken && typeof sessionToken === 'string') {
            params.session_token = sessionToken;
        }

        const response = await axios.get('https://api.mapbox.com/search/searchbox/v1/suggest', {
            params,
            timeout: 5000,
        });

        const data = response.data;
        CacheStore.mapsService.setPlacesResponse(cacheKey, data);

        return res.status(200).json(data);
    } catch (err) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_GATEWAY_MAPS_ROUTER',
            messages: ['Mapbox search proxy error'],
            traceArgs: { 'error.message': err instanceof Error ? err.message : String(err) },
        });
        return res.status(502).json({ message: 'Mapbox search service unavailable' });
    }
});

mapsServiceRouter.get('/mapbox/retrieve/:mapboxId', placesApiLimiter, async (req, res) => {
    const { mapboxId } = req.params;
    const { sessionToken } = req.query;

    if (!mapboxId) {
        return res.status(400).json({ message: 'mapboxId is required' });
    }

    if (!MAPBOX_ACCESS_TOKEN) {
        return res.status(503).json({ message: 'Mapbox search is not configured' });
    }

    const cacheKey = crypto.createHash('sha256').update(`mapbox-retrieve:${mapboxId}`).digest('hex');
    const cached = await CacheStore.mapsService.getPlacesResponse(cacheKey);

    if (cached) {
        return res.status(200).json(cached);
    }

    try {
        const params: Record<string, string> = {
            access_token: MAPBOX_ACCESS_TOKEN,
        };

        if (sessionToken && typeof sessionToken === 'string') {
            params.session_token = sessionToken;
        }

        const response = await axios.get(
            `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}`,
            { params, timeout: 5000 },
        );

        const data = response.data;
        CacheStore.mapsService.setPlacesResponse(cacheKey, data);

        return res.status(200).json(data);
    } catch (err) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_GATEWAY_MAPS_ROUTER',
            messages: ['Mapbox retrieve proxy error'],
            traceArgs: { 'error.message': err instanceof Error ? err.message : String(err) },
        });
        return res.status(502).json({ message: 'Mapbox retrieve service unavailable' });
    }
});

// External APIs - Google Places proxy with rate limiting and caching
mapsServiceRouter.get('/place/*', placesApiLimiter, async (req, res, next) => {
    // Cache GET requests (autocomplete, details) using query string as key
    const cacheKey = crypto.createHash('sha256').update(`${req.path}:${JSON.stringify(req.query)}`).digest('hex');
    const cached = await CacheStore.mapsService.getPlacesResponse(cacheKey);

    if (cached) {
        return res.status(200).json(cached);
    }

    // Store cache key on request for the proxy response handler
    (req as any).placesCacheKey = cacheKey;
    return next();
});

mapsServiceRouter.use('/place', createProxyMiddleware({
    target: 'https://maps.googleapis.com',
    pathRewrite: (path) => `${path.replace('/v1/maps-service/place', '/maps/api/place')}&key=${process.env.GOOGLE_MAPS_PLACES_SERVER_SIDE_API_KEY}`,
    changeOrigin: true,
    proxyTimeout: 10000, // 10s timeout to prevent hanging requests
    selfHandleResponse: true,
    onProxyRes: (proxyRes, req, res) => {
        let body = '';
        proxyRes.on('data', (chunk) => { body += chunk; });
        proxyRes.on('error', () => {
            if (!res.headersSent) {
                res.status(502).json({ message: 'Upstream connection error' });
            }
        });
        proxyRes.on('end', () => {
            const statusCode = proxyRes.statusCode || 500;
            res.status(statusCode);
            Object.keys(proxyRes.headers).forEach((key) => {
                if (proxyRes.headers[key]) {
                    res.setHeader(key, proxyRes.headers[key] as string);
                }
            });

            // Cache successful GET responses
            if (statusCode === 200 && req.method === 'GET' && (req as any).placesCacheKey) {
                try {
                    const parsed = JSON.parse(body);
                    CacheStore.mapsService.setPlacesResponse((req as any).placesCacheKey, parsed);
                } catch (e) {
                    // Non-JSON response, skip caching
                }
            }

            res.end(body);
        });
    },
}));

export default mapsServiceRouter;
