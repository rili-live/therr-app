import axios from 'axios';
import logSpan from 'therr-js-utilities/log-or-update-span';

// Wikipedia / Wikivoyage fetchers. Both have free public APIs and content is
// CC-BY-SA 4.0 — attribution is required in the UI.
//
// Locale → Wikipedia subdomain mapping. We ship three locales; Wikipedia covers
// all three. Wikivoyage has en + es + (some) fr.
export const WIKIPEDIA_USER_AGENT = 'Therr App (https://www.therr.com)';

export type SupportedLocale = 'en-us' | 'es' | 'fr-ca';

const WIKI_SUBDOMAIN: Record<SupportedLocale, string> = {
    'en-us': 'en',
    es: 'es',
    'fr-ca': 'fr',
};

export interface IWikipediaSummary {
    title: string;
    extract: string | null;
    thumbnailUrl: string | null;
    pageUrl: string | null;
}

export interface IWikivoyageSections {
    understand?: string;
    districts?: string;
    getIn?: string;
    getAround?: string;
}

/**
 * Strip wiki markup / HTML noise out of a parse-API section.
 * Wikivoyage returns HTML via ?prop=text; we flatten it to plain text paragraphs.
 */
const stripHtml = (html: string): string => html
    // Drop script/style blocks entirely (paranoia — unlikely in Wikivoyage output)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Drop edit/see-also navboxes
    .replace(/<span class="mw-editsection[\s\S]*?<\/span>/gi, '')
    .replace(/<table[\s\S]*?<\/table>/gi, '')
    // Convert paragraph/br to newlines
    .replace(/<\/(p|li|h[1-6])>/gi, '\n\n')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode a few common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse repeated whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Fetch the Wikipedia summary REST endpoint for a given article title.
 * Returns null if the article doesn't exist or we can't reach Wikipedia.
 */
export const fetchCitySummary = async (
    title: string,
    locale: SupportedLocale,
): Promise<IWikipediaSummary | null> => {
    const subdomain = WIKI_SUBDOMAIN[locale] || 'en';
    const url = `https://${subdomain}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': WIKIPEDIA_USER_AGENT, accept: 'application/json' },
            timeout: 5000,
            validateStatus: (s) => s < 500, // treat 404 as a non-error we handle ourselves
        });

        if (response.status !== 200) return null;
        const data = response.data || {};
        return {
            title: data.title,
            extract: data.extract || null,
            // Prefer originalimage (higher res) then thumbnail. License check happens elsewhere.
            thumbnailUrl: data.originalimage?.source || data.thumbnail?.source || null,
            pageUrl: data.content_urls?.desktop?.page || `https://${subdomain}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        };
    } catch (err) {
        logSpan({
            level: 'warn',
            messageOrigin: 'MAPS_SERVICE',
            messages: ['wikiFetcher: fetchCitySummary error'],
            traceArgs: {
                'wiki.title': title,
                'wiki.locale': locale,
                'error.message': err instanceof Error ? err.message : String(err),
            },
        });
        return null;
    }
};

const SECTION_KEYS: Array<{ key: keyof IWikivoyageSections; aliases: string[] }> = [
    { key: 'understand', aliases: ['Understand', 'Entender', 'Comprendre'] },
    { key: 'districts', aliases: ['Districts', 'Neighborhoods', 'Distritos', 'Barrios', 'Quartiers', 'Arrondissements'] },
    { key: 'getIn', aliases: ['Get in', 'Llegar', 'Cómo llegar', 'Aller'] },
    { key: 'getAround', aliases: ['Get around', 'Moverse', 'Desplazarse', 'Circuler'] },
];

/**
 * Wikivoyage MediaWiki parse API. Returns a list of sections with indexes; we
 * then fetch specific sections we care about by index. Each section fetch is a
 * separate call, so we limit ourselves to the four sections that map into the
 * City Pulse UI.
 */
export const fetchWikivoyageSections = async (
    title: string,
    locale: SupportedLocale,
): Promise<IWikivoyageSections | null> => {
    const subdomain = WIKI_SUBDOMAIN[locale] || 'en';
    const baseUrl = `https://${subdomain}.wikivoyage.org/w/api.php`;

    try {
        // Step 1 — list sections so we can map title → index.
        const sectionsResponse = await axios.get(baseUrl, {
            params: {
                action: 'parse',
                page: title,
                prop: 'sections',
                format: 'json',
                redirects: 1,
            },
            headers: { 'User-Agent': WIKIPEDIA_USER_AGENT, accept: 'application/json' },
            timeout: 5000,
            validateStatus: (s) => s < 500,
        });

        if (sectionsResponse.status !== 200) return null;
        const sectionsList = sectionsResponse.data?.parse?.sections;
        if (!Array.isArray(sectionsList) || !sectionsList.length) return null;

        // Build a lookup: canonical section key → MediaWiki section index
        const indexByKey: Partial<Record<keyof IWikivoyageSections, string>> = {};
        SECTION_KEYS.forEach(({ key, aliases }) => {
            const match = sectionsList.find((s: any) => aliases.some(
                (alias) => typeof s.line === 'string' && s.line.trim().toLowerCase() === alias.toLowerCase(),
            ));
            if (match?.index) indexByKey[key] = String(match.index);
        });

        if (!Object.keys(indexByKey).length) return null;

        // Step 2 — fetch each section's HTML content. Run sequentially (Wikivoyage
        // is lenient but we don't want to DoS ourselves if this ever runs hot).
        const result: IWikivoyageSections = {};
        // eslint-disable-next-line no-restricted-syntax
        for (const [key, sectionIndex] of Object.entries(indexByKey)) {
            // eslint-disable-next-line no-await-in-loop
            const sectionResponse = await axios.get(baseUrl, {
                params: {
                    action: 'parse',
                    page: title,
                    prop: 'text',
                    section: sectionIndex,
                    format: 'json',
                    redirects: 1,
                },
                headers: { 'User-Agent': WIKIPEDIA_USER_AGENT, accept: 'application/json' },
                timeout: 5000,
                validateStatus: (s) => s < 500,
            });

            if (sectionResponse.status === 200) {
                const html = sectionResponse.data?.parse?.text?.['*'];
                if (typeof html === 'string') {
                    const text = stripHtml(html);
                    if (text) result[key as keyof IWikivoyageSections] = text;
                }
            }
        }

        return Object.keys(result).length ? result : null;
    } catch (err) {
        logSpan({
            level: 'warn',
            messageOrigin: 'MAPS_SERVICE',
            messages: ['wikiFetcher: fetchWikivoyageSections error'],
            traceArgs: {
                'wiki.title': title,
                'wiki.locale': locale,
                'error.message': err instanceof Error ? err.message : String(err),
            },
        });
        return null;
    }
};

export const buildWikivoyageAttributionUrl = (title: string, locale: SupportedLocale): string => {
    const subdomain = WIKI_SUBDOMAIN[locale] || 'en';
    return `https://${subdomain}.wikivoyage.org/wiki/${encodeURIComponent(title)}`;
};

export const buildWikipediaAttributionUrl = (title: string, locale: SupportedLocale): string => {
    const subdomain = WIKI_SUBDOMAIN[locale] || 'en';
    return `https://${subdomain}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
};
