import { Cities } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { resolveCityWikipedia } from '../utilities/wikiResolver';
import {
    fetchWikivoyageSections,
    buildWikivoyageAttributionUrl,
    buildWikipediaAttributionUrl,
    SupportedLocale,
} from '../utilities/wikiFetcher';

const SUPPORTED_LOCALES: SupportedLocale[] = ['en-us', 'es', 'fr-ca'];

// In-flight guard so a burst of SSR requests for the same cold city doesn't
// fire N parallel resolutions to Wikipedia.
const inflight = new Set<string>();

const delay = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });

/**
 * Refresh a single slug+locale row. Safe to call on cache-miss as fire-and-forget:
 * the SSR request returns Therr data immediately and the cache populates for the
 * next crawl/visit. Always writes a row (even on not_found) so we don't retry
 * hopeless slugs every page view.
 */
export const refreshCityWikiOne = async (
    slug: string,
    locale: SupportedLocale,
): Promise<void> => {
    const guardKey = `${slug}:${locale}`;
    if (inflight.has(guardKey)) return;
    inflight.add(guardKey);

    try {
        const resolved = await resolveCityWikipedia(slug, locale);

        if (!resolved) {
            await Store.cityWikiCache.upsert({
                slug,
                locale,
                status: 'not_found',
                // Shorter TTL for negatives so a newly-created Wikipedia article
                // starts appearing within a week instead of a month.
                ttlDays: 7,
            });
            return;
        }

        // Wikivoyage lookup is best-effort. Use resolved title from Wikipedia —
        // Wikivoyage articles tend to use the same title as Wikipedia.
        const sections = await fetchWikivoyageSections(
            resolved.title,
            resolved.localeFallback ? 'en-us' : locale,
        );

        // Prefer Wikivoyage attribution when we have Wikivoyage content; otherwise
        // the user-facing content came from Wikipedia and we attribute that.
        const attributionLocale = resolved.localeFallback ? 'en-us' : locale;
        const attributionUrl = sections
            ? buildWikivoyageAttributionUrl(resolved.title, attributionLocale)
            : buildWikipediaAttributionUrl(resolved.title, attributionLocale);

        await Store.cityWikiCache.upsert({
            slug,
            locale,
            resolvedTitle: resolved.title,
            summary: resolved.summary,
            sections,
            // heroImageUrl: license-check for Commons images is not implemented in
            // v1. Leave null until we add Commons API verification.
            heroImageUrl: null,
            attributionUrl,
            license: 'CC-BY-SA-4.0',
            localeFallback: resolved.localeFallback,
            status: 'ok',
        });
    } catch (err) {
        logSpan({
            level: 'error',
            messageOrigin: 'MAPS_SERVICE',
            messages: ['wikiCacheRefresh: unexpected error'],
            traceArgs: {
                'wiki.slug': slug,
                'wiki.locale': locale,
                'error.message': err instanceof Error ? err.message : String(err),
            },
        });
        // Mark as error with short TTL so we retry soon.
        await Store.cityWikiCache.upsert({
            slug,
            locale,
            status: 'error',
            ttlDays: 1,
        });
    } finally {
        inflight.delete(guardKey);
    }
};

/**
 * Refresh a single slug across all provided locales. The SSR handler calls this
 * without awaiting — it returns fast and fills the cache for subsequent crawls.
 */
export const refreshCityWiki = (
    slug: string,
    locales: SupportedLocale[] = SUPPORTED_LOCALES,
): Promise<void[]> => Promise.all(locales.map((locale) => refreshCityWikiOne(slug, locale)));

/**
 * Batch seed entry point. Intended to run out-of-band via:
 *   node lib/workers/wikiCacheRefresh.js --all
 *   node lib/workers/wikiCacheRefresh.js --slug=denver-co,new-york-ny
 *   node lib/workers/wikiCacheRefresh.js --only-expired
 *
 * Staggers 2s between cities to stay well under Wikipedia/Wikivoyage courteous
 * rate limits (≤1 req/sec is a common guideline; we're pulling 1 summary + ≤4
 * sections, so 2s between cities keeps burst rate reasonable).
 */
export const runCli = async (): Promise<void> => {
    const args = process.argv.slice(2);
    const slugArg = args.find((a) => a.startsWith('--slug='));
    const localesArg = args.find((a) => a.startsWith('--locales='));
    const onlyExpired = args.includes('--only-expired');
    const all = args.includes('--all');

    const locales: SupportedLocale[] = localesArg
        ? (localesArg.split('=')[1].split(',') as SupportedLocale[])
        : SUPPORTED_LOCALES;

    let slugs: string[] = [];
    if (slugArg) {
        slugs = slugArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (onlyExpired) {
        const expired = await Store.cityWikiCache.findExpired(500);
        slugs = Array.from(new Set(expired.map((r) => r.slug)));
    } else if (all) {
        slugs = Cities.CitiesList.map((c) => c.slug);
    } else {
        // eslint-disable-next-line no-console
        console.log('Usage: wikiCacheRefresh --all | --slug=a,b | --only-expired  [--locales=en-us,es,fr-ca]');
        process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log(`Refreshing ${slugs.length} cities × ${locales.length} locales`);

    for (let i = 0; i < slugs.length; i += 1) {
        const slug = slugs[i];
        // eslint-disable-next-line no-console
        console.log(`[${i + 1}/${slugs.length}] ${slug}`);
        // eslint-disable-next-line no-await-in-loop
        await refreshCityWiki(slug, locales);
        if (i < slugs.length - 1) {
            // eslint-disable-next-line no-await-in-loop
            await delay(2000);
        }
    }

    // eslint-disable-next-line no-console
    console.log('Done.');
};

// When invoked directly (not imported), run the CLI entrypoint.
if (require.main === module) {
    runCli()
        .then(() => process.exit(0))
        .catch((err) => {
            // eslint-disable-next-line no-console
            console.error(err);
            process.exit(1);
        });
}
