/**
 * Localization for the Friends with Habits landing page (habits.therr.com).
 *
 * The landing is a self-contained Handlebars view, not part of the React app, so it
 * cannot use the React translator. Its copy lives in src/habitsLocales/<locale>/dictionary.json
 * (kept in key parity by `npm run locales:check`) and is handed to the view whole.
 *
 * URL scheme mirrors www.therr.app (the therr-landing repo): English is unprefixed at `/`,
 * Spanish is `/es`, French is `/fr`. Each locale is a distinct, indexable URL with hreflang
 * alternates, so a Spanish search result and a Spanish ad can both point straight at `/es`.
 *
 * Locale resolution on a request for a landing path, in priority order:
 *   1. `?lang=en|es|fr` — an explicit pick from the language switcher. Remembered in a
 *      cookie and redirected to the clean URL for that locale.
 *   2. `/es` or `/fr` in the path — always rendered as asked, never redirected away from,
 *      so a link someone shared (or an ad's final URL) shows what it says it shows.
 *   3. On `/` only: the remembered cookie, then the browser's Accept-Language. A visitor
 *      whose browser prefers Spanish (most of the traffic from Mexico) is redirected to `/es`.
 *   4. Otherwise English.
 *
 * Kept out of server-client.tsx so it is unit-testable: importing that file starts an
 * Express listener.
 */
import serialize from 'serialize-javascript';
import enUsDictionary from '../habitsLocales/en-us/dictionary.json';
import esDictionary from '../habitsLocales/es/dictionary.json';
import frCaDictionary from '../habitsLocales/fr-ca/dictionary.json';

export type HabitsLandingLocale = 'en-us' | 'es' | 'fr-ca';

export type HabitsLandingCopy = typeof enUsDictionary;

interface IHabitsLandingLocaleConfig {
    locale: HabitsLandingLocale;
    /** Clean URL path for this locale's landing page. */
    path: '/' | '/es' | '/fr';
    /** Value of the `?lang=` switcher param and of the remembered cookie. */
    code: 'en' | 'es' | 'fr';
    htmlLang: string;
    ogLocale: string;
    hreflang: string;
    shortLabel: string;
    /** Each language's name in that language, so a visitor can find their own. */
    nativeName: string;
    copy: HabitsLandingCopy;
}

export const HABITS_ORIGIN = 'https://habits.therr.com';

export const HABITS_LOCALE_COOKIE = 'habits-locale';
const HABITS_LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const HABITS_LANDING_LOCALES: IHabitsLandingLocaleConfig[] = [
    {
        locale: 'en-us',
        path: '/',
        code: 'en',
        htmlLang: 'en-US',
        ogLocale: 'en_US',
        hreflang: 'en',
        shortLabel: 'EN',
        nativeName: 'English',
        copy: enUsDictionary,
    },
    {
        locale: 'es',
        path: '/es',
        code: 'es',
        htmlLang: 'es',
        ogLocale: 'es_MX',
        hreflang: 'es',
        shortLabel: 'ES',
        nativeName: 'Español',
        copy: esDictionary,
    },
    {
        locale: 'fr-ca',
        path: '/fr',
        code: 'fr',
        htmlLang: 'fr-CA',
        ogLocale: 'fr_CA',
        hreflang: 'fr',
        shortLabel: 'FR',
        nativeName: 'Français',
        copy: frCaDictionary,
    },
];

const DEFAULT_LOCALE_CONFIG = HABITS_LANDING_LOCALES[0];

const getLocaleConfigByCode = (code: string | null | undefined): IHabitsLandingLocaleConfig | null => {
    const normalized = (code || '').trim().toLowerCase();
    return HABITS_LANDING_LOCALES.find((config) => config.code === normalized) || null;
};

const getLocaleConfig = (locale: HabitsLandingLocale): IHabitsLandingLocaleConfig => HABITS_LANDING_LOCALES
    .find((config) => config.locale === locale) || DEFAULT_LOCALE_CONFIG;

/**
 * The landing locale a path serves, or null when the path is not a landing page.
 * A trailing slash is tolerated on the prefixed paths ('/es/') so a hand-typed URL works.
 */
export const matchHabitsLandingPath = (pathname: string): HabitsLandingLocale | null => {
    if (pathname === '/') {
        return 'en-us';
    }
    const match = pathname.match(/^\/(es|fr)\/?$/);
    return match ? (getLocaleConfigByCode(match[1]) as IHabitsLandingLocaleConfig).locale : null;
};

/**
 * Best supported locale from an Accept-Language header, honouring q-values, or null when
 * the browser prefers none of them. Region subtags are ignored ('es-MX', 'es-419' → es),
 * and so is the order of equally-weighted entries beyond the browser's own listing order.
 */
export const parseHabitsAcceptLanguage = (header: string | null | undefined): HabitsLandingLocale | null => {
    if (!header) {
        return null;
    }
    const ranked = header.split(',')
        .map((entry, index) => {
            const [tag, ...params] = entry.trim().split(';');
            const qParam = params.map((param) => param.trim()).find((param) => param.indexOf('q=') === 0);
            const q = qParam ? parseFloat(qParam.slice(2)) : 1;
            return { primary: tag.trim().toLowerCase().split('-')[0], q: Number.isNaN(q) ? 0 : q, index };
        })
        .filter((entry) => entry.primary && entry.q > 0)
        .sort((a, b) => (b.q - a.q) || (a.index - b.index));

    const best = ranked.map((entry) => getLocaleConfigByCode(entry.primary)).find(Boolean);
    return best ? best.locale : null;
};

const safeDecodeURIComponent = (value: string): string | null => {
    try {
        return decodeURIComponent(value);
    } catch (err) {
        return null;
    }
};

/**
 * The locale a visitor picked with the switcher on an earlier visit, if any.
 *
 * The cookie is client-controlled, so a malformed escape ('%E0') must read as "no choice":
 * decodeURIComponent throws on it, and this runs inside an async Express 4 middleware where a
 * throw becomes an unhandled rejection that takes the whole process down.
 */
export const readHabitsLocaleCookie = (cookieHeader: string | null | undefined): HabitsLandingLocale | null => {
    const match = (cookieHeader || '').match(new RegExp(`(?:^|;\\s*)${HABITS_LOCALE_COOKIE}=([^;]*)`));
    const config = match ? getLocaleConfigByCode(safeDecodeURIComponent(match[1])) : null;
    return config ? config.locale : null;
};

const buildLocation = (path: string, params: URLSearchParams): string => {
    const query = params.toString();
    return query ? `${path}?${query}` : path;
};

export type HabitsLandingResolution =
    | { action: 'render'; locale: HabitsLandingLocale }
    | { action: 'redirect'; location: string; setCookie?: string };

/**
 * Decides whether a landing request renders, and in which locale, or redirects.
 *
 * Every redirect keeps the rest of the query string. Paid clicks arrive carrying gclid and
 * utm_* parameters, and dropping them on the way to `/es` would strip the attribution the
 * campaign is judged by.
 */
export const resolveHabitsLandingRequest = ({
    pathname,
    search,
    cookieHeader,
    acceptLanguage,
}: {
    pathname: string;
    /** The raw query string, with or without its leading '?'. */
    search: string;
    cookieHeader?: string | null;
    acceptLanguage?: string | null;
}): HabitsLandingResolution | null => {
    const pathLocale = matchHabitsLandingPath(pathname);
    if (!pathLocale) {
        return null;
    }

    const params = new URLSearchParams(search);
    if (params.has('lang')) {
        const picked = getLocaleConfigByCode(params.get('lang'));
        params.delete('lang');
        if (picked) {
            return {
                action: 'redirect',
                location: buildLocation(picked.path, params),
                setCookie: `${HABITS_LOCALE_COOKIE}=${picked.code}; Path=/; Max-Age=${HABITS_LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`,
            };
        }
        // An unrecognised value is ignored rather than 404'd; drop it so the URL is clean.
        return { action: 'redirect', location: buildLocation(getLocaleConfig(pathLocale).path, params) };
    }

    if (pathLocale !== DEFAULT_LOCALE_CONFIG.locale) {
        return { action: 'render', locale: pathLocale };
    }

    const preferred = readHabitsLocaleCookie(cookieHeader) || parseHabitsAcceptLanguage(acceptLanguage);
    if (preferred && preferred !== DEFAULT_LOCALE_CONFIG.locale) {
        return { action: 'redirect', location: buildLocation(getLocaleConfig(preferred).path, params) };
    }

    return { action: 'render', locale: DEFAULT_LOCALE_CONFIG.locale };
};

const interpolate = <T>(value: T, vars: Record<string, string | number>): T => {
    if (typeof value === 'string') {
        return value.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole)) as unknown as T;
    }
    if (value && typeof value === 'object') {
        return Object.keys(value).reduce((acc, key) => {
            acc[key] = interpolate(value[key], vars);
            return acc;
        }, {} as any);
    }
    return value;
};

/** FAQ entries in the order they appear in the FAQPage structured data. */
const FAQ_KEYS = ['whatIs', 'isFree', 'founderUnlock', 'whatIsPact', 'needFriend', 'checkIns', 'iphone', 'whoMakes'] as const;

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.therr.habits';
const OG_IMAGE_URL = `${HABITS_ORIGIN}/assets/images/habits-og-image.png`;

const toCanonicalUrl = (config: IHabitsLandingLocaleConfig) => (config.path === '/' ? HABITS_ORIGIN : `${HABITS_ORIGIN}${config.path}`);

/**
 * Entity graph for search and AI answer engines.
 *
 * Built from the same dictionary the visible copy renders from, so the FAQPage answers are
 * the visible FAQ answers by construction — Google demotes FAQ markup whose answers are not
 * on the page. `publisher` points at the Organization node declared on www.therr.app so the
 * two properties resolve to one company entity across both domains.
 */
export const buildHabitsLandingJsonLd = (locale: HabitsLandingLocale, copy: HabitsLandingCopy) => {
    const config = getLocaleConfig(locale);
    const canonicalUrl = toCanonicalUrl(config);
    const pageUrl = config.path === '/' ? `${HABITS_ORIGIN}/` : canonicalUrl;
    const { jsonLd } = copy;

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                '@id': `${HABITS_ORIGIN}/#website`,
                url: `${HABITS_ORIGIN}/`,
                name: 'Friends with Habits',
                description: jsonLd.websiteDescription,
                slogan: copy.hero.motto,
                inLanguage: config.htmlLang,
                publisher: { '@id': 'https://www.therr.app/#organization' },
            },
            {
                '@type': 'Organization',
                '@id': 'https://www.therr.app/#organization',
                name: 'Therr, Inc.',
                url: 'https://www.therr.app/',
                logo: 'https://www.therr.app/assets/img/therr-splash-logo-200.png',
                sameAs: [
                    'https://www.therr.com/',
                    'https://www.instagram.com/therr.app/',
                    'https://twitter.com/therr_app',
                    'https://www.linkedin.com/company/therr',
                ],
            },
            {
                '@type': 'WebPage',
                '@id': `${pageUrl}#webpage`,
                url: pageUrl,
                name: copy.meta.title,
                isPartOf: { '@id': `${HABITS_ORIGIN}/#website` },
                about: { '@id': `${HABITS_ORIGIN}/#app` },
                primaryImageOfPage: OG_IMAGE_URL,
                inLanguage: config.htmlLang,
            },
            {
                '@type': 'MobileApplication',
                '@id': `${HABITS_ORIGIN}/#app`,
                name: 'Friends with Habits',
                alternateName: 'Therr: Friends With Habits',
                url: pageUrl,
                description: jsonLd.appDescription,
                slogan: copy.hero.motto,
                applicationCategory: 'LifestyleApplication',
                applicationSubCategory: jsonLd.applicationSubCategory,
                operatingSystem: jsonLd.operatingSystem,
                releaseNotes: jsonLd.releaseNotes,
                installUrl: PLAY_STORE_URL,
                downloadUrl: PLAY_STORE_URL,
                screenshot: OG_IMAGE_URL,
                image: OG_IMAGE_URL,
                inLanguage: config.htmlLang,
                featureList: [
                    jsonLd.features.pacts,
                    jsonLd.features.checkIns,
                    jsonLd.features.streaks,
                    jsonLd.features.notifications,
                    jsonLd.features.feed,
                ],
                offers: [
                    {
                        '@type': 'Offer',
                        name: jsonLd.freeOfferName,
                        description: jsonLd.freeOfferDescription,
                        price: '0',
                        priceCurrency: 'USD',
                        availability: 'https://schema.org/InStock',
                    },
                    {
                        '@type': 'Offer',
                        name: jsonLd.founderOfferName,
                        description: jsonLd.founderOfferDescription,
                        price: '20',
                        priceCurrency: 'USD',
                        availability: 'https://schema.org/LimitedAvailability',
                        eligibleQuantity: {
                            '@type': 'QuantitativeValue',
                            value: 5000,
                            unitText: jsonLd.accountsUnit,
                        },
                    },
                ],
                publisher: { '@id': 'https://www.therr.app/#organization' },
            },
            {
                '@type': 'FAQPage',
                '@id': `${pageUrl}#faq`,
                isPartOf: { '@id': `${pageUrl}#webpage` },
                inLanguage: config.htmlLang,
                mainEntity: FAQ_KEYS.map((key) => ({
                    '@type': 'Question',
                    name: copy.faq[key].question,
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: copy.faq[key].answer,
                    },
                })),
            },
        ],
    };
};

/**
 * Everything the habits/landing view needs to render one locale.
 *
 * Dictionary values are trusted repository content and several carry inline markup
 * (<strong>, <em>, entities), so the view renders them with the triple-stash.
 */
export const buildHabitsLandingViewContext = (
    locale: HabitsLandingLocale,
    // Marketing copy quotes the free-tier cap; passing the constant keeps it from drifting when
    // the default changes. An env override must be set on this deployment too, not only users-service.
    { freeHabitLimit }: { freeHabitLimit: number | string },
) => {
    const config = getLocaleConfig(locale);
    const copy = interpolate(config.copy, { freeHabitLimit });

    return {
        t: copy,
        // The shared footer partial reads this; every other habits view omits it and
        // gets the partial's English fallback.
        footerCopy: copy.footer,
        htmlLang: config.htmlLang,
        ogLocale: config.ogLocale,
        ogLocaleAlternates: HABITS_LANDING_LOCALES
            .filter((other) => other.locale !== config.locale)
            .map((other) => other.ogLocale),
        // Brand name first, then the head term the page competes for, in every language:
        // a title that leads with the tagline runs long and SERPs truncate it before any keyword.
        title: copy.meta.title,
        description: copy.meta.description,
        canonicalUrl: toCanonicalUrl(config),
        // The logo links back to this locale's landing, not to `/` and its redirect.
        homePath: config.path,
        hreflangAlternates: [
            ...HABITS_LANDING_LOCALES.map((other) => ({ hreflang: other.hreflang, href: toCanonicalUrl(other) })),
            { hreflang: 'x-default', href: toCanonicalUrl(DEFAULT_LOCALE_CONFIG) },
        ],
        currentLanguageLabel: config.shortLabel,
        languageOptions: HABITS_LANDING_LOCALES.map((other) => ({
            // The switcher goes through `?lang=` so the server can remember the pick; without
            // it, choosing English on `/` would bounce a Spanish browser straight back to `/es`.
            href: `${other.path}?lang=${other.code}`,
            hreflang: other.hreflang,
            shortLabel: other.shortLabel,
            nativeName: other.nativeName,
            isCurrent: other.locale === config.locale,
        })),
        // serialize-javascript escapes <, >, / and friends, so this is safe inside <script>.
        jsonLd: serialize(buildHabitsLandingJsonLd(config.locale, copy), { isJSON: true, space: 2 }),
    };
};
