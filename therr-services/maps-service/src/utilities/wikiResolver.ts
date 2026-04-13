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

    // Try the requested locale first.
    for (const title of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const summary = await fetchCitySummary(title, locale);
        if (summary?.extract && summary.extract.length > 40) {
            return {
                title: summary.title,
                summary: summary.extract,
                thumbnailUrl: summary.thumbnailUrl,
                pageUrl: summary.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`,
                localeFallback: false,
            };
        }
    }

    // Fall back to en-us for non-English locales.
    if (locale !== 'en-us') {
        for (const title of candidates) {
            // eslint-disable-next-line no-await-in-loop
            const summary = await fetchCitySummary(title, 'en-us');
            if (summary?.extract && summary.extract.length > 40) {
                return {
                    title: summary.title,
                    summary: summary.extract,
                    thumbnailUrl: summary.thumbnailUrl,
                    pageUrl: summary.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`,
                    localeFallback: true,
                };
            }
        }
    }

    return null;
};
