import { Cities } from 'therr-js-utilities/constants';
import { fetchCitySummary, SupportedLocale } from './wikiFetcher';

// Slug → Wikipedia article title resolution. Cities.ts is the source of truth
// for lat/lng and display name, but city names collide ("Columbus, OH" vs
// "Columbus, GA") so we try a couple of strategies in order before giving up.

export interface IResolvedCity {
    title: string;
    summary: string;
    thumbnailUrl: string | null;
    pageUrl: string;
    localeFallback: boolean;
}

/**
 * Resolve a city slug to a Wikipedia article title. Strategy:
 *   1) Try "{City}, {State}" — the most reliable canonical form for US cities.
 *   2) Try bare "{City}" — works for globally unique names (San Francisco, Chicago).
 *   3) Fall back to en-us if a non-English locale returned nothing.
 */
export const resolveCityWikipedia = async (
    slug: string,
    locale: SupportedLocale,
): Promise<IResolvedCity | null> => {
    const city = Cities.CitySlugMap[slug];
    if (!city) return null;

    const candidates = [
        `${city.name}, ${city.state}`,
        city.name,
    ];

    // Try candidates sequentially: stop at first successful extract. We want
    // the short-circuit on success, so this intentionally does not use
    // Promise.all / array iteration.
    const tryCandidates = async (
        tryLocale: SupportedLocale,
        localeFallback: boolean,
    ): Promise<IResolvedCity | null> => candidates.reduce<Promise<IResolvedCity | null>>(
        async (accPromise, title) => {
            const acc = await accPromise;
            if (acc) return acc;
            const summary = await fetchCitySummary(title, tryLocale);
            if (summary?.extract && summary.extract.length > 40) {
                return {
                    title: summary.title,
                    summary: summary.extract,
                    thumbnailUrl: summary.thumbnailUrl,
                    pageUrl: summary.pageUrl
                        || `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`,
                    localeFallback,
                };
            }
            return null;
        },
        Promise.resolve(null),
    );

    const primary = await tryCandidates(locale, false);
    if (primary) return primary;

    // Fall back to en-us for non-English locales.
    if (locale !== 'en-us') {
        const fallback = await tryCandidates('en-us', true);
        if (fallback) return fallback;
    }

    return null;
};
