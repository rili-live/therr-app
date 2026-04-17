import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import { Cities } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { refreshCityWiki } from '../workers/wikiCacheRefresh';
import { SupportedLocale } from '../utilities/wikiFetcher';

// City Pulse aggregation endpoint. Fans out to spaces/events/moments in parallel
// and composes a single response the SSR + client consume directly. Wiki content
// is served from cache; a cold cache fires a background refresh and returns
// Therr-only content.

const PULSE_RADIUS_METERS = 50000; // 50 km metro radius (matches ListSpaces).
const TRENDING_SPACES_LIMIT = 12;
const UPCOMING_EVENTS_LIMIT = 12;
const RECENT_MOMENTS_LIMIT = 18;

// Must match api-gateway normalizePulseLocale(): exact-match against the
// supported set, else fall back to "en-us". Handles arrays that Express may
// produce when a query param is repeated.
const toLocale = (raw: unknown): SupportedLocale => {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === 'es' || value === 'fr-ca' || value === 'en-us') return value;
    return 'en-us';
};

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
};

const NEARBY_RADIUS_KM = 300;
const NEARBY_CITIES_LIMIT = 3;

type NearbyEntry = { slug: string; name: string; stateAbbr: string; distanceKm: number };

// Precompute nearby cities per slug at module load so each request is an O(1)
// lookup instead of scanning CitiesList on every /pulse hit.
const nearbyCitiesAdjacency: Record<string, NearbyEntry[]> = (() => {
    const map: Record<string, NearbyEntry[]> = {};
    Cities.CitiesList.forEach((origin) => {
        const neighbors: NearbyEntry[] = [];
        Cities.CitiesList.forEach((c) => {
            if (c.slug === origin.slug) return;
            const distanceKm = haversineKm(origin.lat, origin.lng, c.lat, c.lng);
            if (distanceKm <= NEARBY_RADIUS_KM) {
                neighbors.push({
                    slug: c.slug,
                    name: c.name,
                    stateAbbr: c.stateAbbr,
                    distanceKm,
                });
            }
        });
        neighbors.sort((a, b) => a.distanceKm - b.distanceKm);
        map[origin.slug] = neighbors.slice(0, NEARBY_CITIES_LIMIT);
    });
    return map;
})();

/**
 * GET /cities/:slug/pulse
 */
const getCityPulse: RequestHandler = async (req: any, res: any) => {
    const { slug } = req.params;
    const city = Cities.CitySlugMap[slug];
    if (!city) {
        return handleHttpError({
            res,
            message: 'City not found',
            statusCode: 404,
        });
    }

    const { locale: headerLocale } = parseHeaders(req.headers);
    const locale = toLocale(req.query?.locale || headerLocale);

    // Build an auth-optional "headers" object for internal calls. We set
    // isRequestAuthorized=false so stores return the public columns only.
    const baseConditions: any = {
        latitude: city.lat,
        longitude: city.lng,
        filterBy: 'distance',
    };
    const overrides = {
        distanceOverride: PULSE_RADIUS_METERS,
        isRequestAuthorized: false,
        withUser: false,
    };

    // Fan out. Failures in any one source degrade gracefully to an empty list.
    const spacesPromise = Store.spaces
        .searchSpaces(
            { ...baseConditions, pagination: { itemsPerPage: TRENDING_SPACES_LIMIT, pageNumber: 1 } },
            null,
            [],
            overrides,
            true,
        )
        .catch((err: any) => {
            logSpan({
                level: 'error',
                messageOrigin: 'MAPS_SERVICE',
                messages: ['cityPulse: spaces fetch failed'],
                traceArgs: { 'error.message': err?.message, 'city.slug': slug },
            });
            return [];
        });

    const eventsPromise = Store.events
        .searchEvents(
            req.headers,
            { ...baseConditions, pagination: { itemsPerPage: UPCOMING_EVENTS_LIMIT, pageNumber: 1 } },
            null,
            [],
            overrides,
            true,
        )
        .catch((err: any) => {
            logSpan({
                level: 'error',
                messageOrigin: 'MAPS_SERVICE',
                messages: ['cityPulse: events fetch failed'],
                traceArgs: { 'error.message': err?.message, 'city.slug': slug },
            });
            return [];
        });

    const momentsPromise = Store.moments
        .searchMoments(
            req.headers,
            { ...baseConditions, pagination: { itemsPerPage: RECENT_MOMENTS_LIMIT, pageNumber: 1 } },
            null,
            [],
            overrides,
            true,
        )
        .catch((err: any) => {
            logSpan({
                level: 'error',
                messageOrigin: 'MAPS_SERVICE',
                messages: ['cityPulse: moments fetch failed'],
                traceArgs: { 'error.message': err?.message, 'city.slug': slug },
            });
            return [];
        });

    const wikiPromise = Store.cityWikiCache
        .get(slug, locale)
        .then((row) => {
            // Lazy-fill on miss or expiry. Fire-and-forget — the user gets fast
            // response now; next crawl/visit gets the enriched page.
            if (!row || !Store.cityWikiCache.isFresh(row)) {
                refreshCityWiki(slug, [locale]).catch((err) => {
                    logSpan({
                        level: 'warn',
                        messageOrigin: 'MAPS_SERVICE',
                        messages: ['cityPulse: background wiki refresh failed'],
                        traceArgs: {
                            'error.message': err?.message,
                            'city.slug': slug,
                            'city.locale': locale,
                        },
                    });
                });
            }
            return row;
        })
        .catch(() => null);

    const [spaces, events, moments, wiki] = await Promise.all([
        spacesPromise,
        eventsPromise,
        momentsPromise,
        wikiPromise,
    ]);

    // Category counts — only non-empty categories so the UI renders a variable
    // number of tiles and stays useful for small cities.
    const categoryCounts: Record<string, number> = {};
    (spaces || []).forEach((space: any) => {
        if (space?.category) {
            categoryCounts[space.category] = (categoryCounts[space.category] || 0) + 1;
        }
    });
    const categoriesWithCounts = Object.entries(categoryCounts)
        .map(([categorySlug, count]) => ({ categorySlug, count }))
        .sort((a, b) => b.count - a.count);

    // Nearby cities — served from the adjacency map computed at module load.
    const nearbyCities = nearbyCitiesAdjacency[city.slug] || [];

    const body = {
        city: {
            slug: city.slug,
            name: city.name,
            state: city.state,
            stateAbbr: city.stateAbbr,
            lat: city.lat,
            lng: city.lng,
        },
        therr: {
            trendingSpaces: spaces || [],
            upcomingEvents: events || [],
            recentMoments: moments || [],
            topGroups: [], // Forums lack geo tags today; keep the shape for forward compat.
            categoriesWithCounts,
        },
        wiki: wiki && wiki.status === 'ok' ? {
            summary: wiki.summary,
            sections: wiki.sections || null,
            heroImageUrl: wiki.heroImageUrl,
            attributionUrl: wiki.attributionUrl,
            license: wiki.license || 'CC-BY-SA-4.0',
            localeFallback: !!wiki.localeFallback,
        } : {
            summary: null,
            sections: null,
            heroImageUrl: null,
            attributionUrl: null,
            license: 'CC-BY-SA-4.0',
            localeFallback: false,
        },
        nearbyCities,
        locale,
    };

    return res.status(200).send(body);
};

export default getCityPulse;
