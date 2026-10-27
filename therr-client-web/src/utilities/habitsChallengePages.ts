/**
 * Programmatic SEO guides for Friends with Habits: habits.therr.com/challenges/30-day-no-spend,
 * /es/retos/30-dias-sin-gastar, /fr/defis/30-jours-sans-depenser, and one hub per locale.
 *
 * The pages are generated from template × length × locale. The catalog below says which habit
 * templates get a page and at which lengths; the words are data, written once per locale in
 * src/habitsChallengeLocales/<locale>/dictionary.json (kept in key parity by `npm run locales:check`).
 * Every page has a template-specific explanation, rules, failure points, FAQ and a note about
 * its length, so no two pages are the same text with a number swapped: a subdomain full of
 * near-duplicates gets demoted as a whole, and this one has almost no inbound links to lose.
 *
 * Rules for growing it (docs/ADJACENCY_MARKETING.md):
 *   - A template earns a page only if real people search for that challenge, and only at lengths
 *     the app can honestly run. A pact runs 30 days and re-commits for another 30 with its streak
 *     intact, so 60 and 90 are two or three cycles. 7 and 14 need the challenge flow, which is not
 *     on Play yet; add them when it is.
 *   - Never a trademarked program's name, in a slug, a title or the copy.
 *   - SLUGS ARE PERMANENT. A page's URL is what Search Console has learned; changing one throws
 *     that away. `habitsChallengePages.test.ts` pins every path, so a rename fails CI. Fix copy
 *     freely; add a new slug rather than editing an old one.
 *
 * Kept out of server-client.tsx so it is unit-testable: importing that file starts an Express listener.
 */
import serialize from 'serialize-javascript';
import enUsDictionary from '../habitsChallengeLocales/en-us/dictionary.json';
import esDictionary from '../habitsChallengeLocales/es/dictionary.json';
import frCaDictionary from '../habitsChallengeLocales/fr-ca/dictionary.json';
import { HABITS_LANDING_LOCALES, HABITS_ORIGIN, HabitsLandingLocale } from './habitsLanding';

type HabitsChallengeCopy = typeof enUsDictionary;
interface IQuestion { question: string; answer: string }
type ChallengeCopy = Omit<HabitsChallengeCopy['challenges']['noSpendDay'], 'longForm'> & {
    safetyNote?: string;
    lengthNotes: Partial<Record<LengthKey, string>>;
    /**
     * What only the longer version of a challenge has: milestones past day 30 and a question of
     * its own. Without it the 60- and 90-day pages repeat three quarters of the 30-day page.
     */
    longForm?: Partial<Record<LengthKey, { milestones: { title: string; body: string }[]; faq: IQuestion }>>;
};

export type HabitsChallengeLength = 30 | 60 | 90;
type LengthKey = 'd30' | 'd60' | 'd90';
type ChallengeCategory = keyof HabitsChallengeCopy['categories'];

/** How often the habit is checked in. 'daily' or N days a week, as the in-app cadence picker offers. */
type Cadence = 'daily' | number;

interface IHabitsChallengeTemplate {
    /** `habits.habit_goals."templateKey"` of the template the page sends people to. */
    templateKey: keyof HabitsChallengeCopy['challenges'];
    /** The picker category the template is seeded into, so "pick it under X" is true. */
    category: ChallengeCategory;
    /** The cadence the template is seeded with (see the habit_goals seed migrations). */
    templateCadence: Cadence;
    /** The cadence this challenge asks for. Differs when the template is a gentler default. */
    challengeCadence: Cadence;
    lengths: HabitsChallengeLength[];
}

/**
 * The templates that get pages, in hub order within each category. Lengths are where search
 * demand is: 30 for every one, plus the longer form people actually search for.
 */
export const HABITS_CHALLENGE_TEMPLATES: IHabitsChallengeTemplate[] = [
    {
        templateKey: 'noSpendDay', category: 'money', templateCadence: 3, challengeCadence: 'daily', lengths: [30, 90],
    },
    {
        templateKey: 'steps10k', category: 'fitness', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30, 60],
    },
    {
        templateKey: 'workOut', category: 'fitness', templateCadence: 3, challengeCadence: 'daily', lengths: [30, 90],
    },
    {
        templateKey: 'run', category: 'fitness', templateCadence: 3, challengeCadence: 3, lengths: [30, 60],
    },
    {
        templateKey: 'noAddedSugar', category: 'health', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30, 60],
    },
    {
        templateKey: 'soberCurious', category: 'health', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30, 90],
    },
    {
        templateKey: 'coldShower', category: 'health', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30, 60],
    },
    {
        templateKey: 'drinkWater', category: 'health', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30],
    },
    {
        templateKey: 'meditate', category: 'mindfulness', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30, 60],
    },
    {
        templateKey: 'dailyJournal', category: 'mindfulness', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30],
    },
    {
        templateKey: 'read15', category: 'learning', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30, 90],
    },
    {
        templateKey: 'screenTimeLimit', category: 'productivity', templateCadence: 'daily', challengeCadence: 'daily', lengths: [30],
    },
];

const CATEGORY_ORDER: ChallengeCategory[] = ['money', 'fitness', 'health', 'mindfulness', 'learning', 'productivity'];

/**
 * Sitemap lastmod and the Article's dateModified. Bump it when the copy changes materially; a
 * lastmod that moves on every deploy (or every request) teaches Google to ignore it.
 */
export const HABITS_CHALLENGE_PAGES_PUBLISHED = '2026-10-24';
export const HABITS_CHALLENGE_PAGES_UPDATED = '2026-10-24';

const COPY: Record<HabitsLandingLocale, HabitsChallengeCopy> = {
    'en-us': enUsDictionary,
    es: esDictionary,
    'fr-ca': frCaDictionary,
};

/** The hub for each locale. The pages live under it. Permanent, like the slugs. */
export const HABITS_CHALLENGE_HUB_PATHS: Record<HabitsLandingLocale, string> = {
    'en-us': '/challenges',
    es: '/es/retos',
    'fr-ca': '/fr/defis',
};

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.therr.habits';
const OG_IMAGE_URL = `${HABITS_ORIGIN}/assets/images/habits-og-image.png`;
const ORGANIZATION_ID = 'https://www.therr.app/#organization';

const LOCALES = HABITS_LANDING_LOCALES.map((config) => config.locale);
const DEFAULT_LOCALE: HabitsLandingLocale = 'en-us';

const getLocaleConfig = (locale: HabitsLandingLocale) => HABITS_LANDING_LOCALES
    .find((config) => config.locale === locale) as typeof HABITS_LANDING_LOCALES[number];

const lengthKey = (days: HabitsChallengeLength): LengthKey => `d${days}` as LengthKey;

const getChallengeCopy = (locale: HabitsLandingLocale, templateKey: IHabitsChallengeTemplate['templateKey']): ChallengeCopy => COPY[locale]
    .challenges[templateKey] as ChallengeCopy;

const fill = (value: string, vars: Record<string, string | number>): string => value
    .replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));

export const getHabitsChallengePagePath = (
    locale: HabitsLandingLocale,
    templateKey: IHabitsChallengeTemplate['templateKey'],
    days: HabitsChallengeLength,
): string => `${HABITS_CHALLENGE_HUB_PATHS[locale]}/${days}-${COPY[locale].ui.dayWord}-${getChallengeCopy(locale, templateKey).slug}`;

const toUrl = (path: string) => `${HABITS_ORIGIN}${path}`;

export type HabitsChallengeRouteMatch =
    | { kind: 'hub'; locale: HabitsLandingLocale }
    | { kind: 'page'; locale: HabitsLandingLocale; template: IHabitsChallengeTemplate; days: HabitsChallengeLength };

// Built once: every servable path, so matching is a lookup and an unknown slug is a 404.
const ROUTES = new Map<string, HabitsChallengeRouteMatch>();
LOCALES.forEach((locale) => {
    ROUTES.set(HABITS_CHALLENGE_HUB_PATHS[locale], { kind: 'hub', locale });
    HABITS_CHALLENGE_TEMPLATES.forEach((template) => {
        template.lengths.forEach((days) => {
            ROUTES.set(getHabitsChallengePagePath(locale, template.templateKey, days), {
                kind: 'page', locale, template, days,
            });
        });
    });
});

/** Every page and hub path, for the sitemap and the tests. */
export const HABITS_CHALLENGE_PATHS = Array.from(ROUTES.keys());

/** The hub or guide a path serves, or null. A trailing slash is tolerated so a shared link with one still works. */
export const matchHabitsChallengePath = (pathname: string): HabitsChallengeRouteMatch | null => {
    const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
    return ROUTES.get(normalized) || null;
};

const hreflangAlternates = (pathFor: (locale: HabitsLandingLocale) => string) => [
    ...LOCALES.map((locale) => ({ hreflang: getLocaleConfig(locale).hreflang, href: toUrl(pathFor(locale)) })),
    { hreflang: 'x-default', href: toUrl(pathFor(DEFAULT_LOCALE)) },
];

const scheduleLabel = (copy: HabitsChallengeCopy, cadence: Cadence) => (cadence === 'daily'
    ? copy.ui.schedule.daily
    : fill(copy.ui.schedule.weekly, { count: cadence }));

/**
 * The parts both views share: locale, the landing footer copy (which carries the hub link), the
 * logo's home path and the language links.
 */
const buildChromeContext = (locale: HabitsLandingLocale, pathFor: (other: HabitsLandingLocale) => string) => {
    const config = getLocaleConfig(locale);
    return {
        htmlLang: config.htmlLang,
        ogLocale: config.ogLocale,
        ogLocaleAlternates: HABITS_LANDING_LOCALES.filter((other) => other.locale !== locale).map((other) => other.ogLocale),
        homePath: config.path,
        footerCopy: config.copy.footer,
        hubPath: HABITS_CHALLENGE_HUB_PATHS[locale],
        // Direct links to this page in the other languages. Unlike the landing page's switcher these
        // need no `?lang=` round trip: only '/' redirects by browser language, so nothing bounces back.
        languageLinks: HABITS_LANDING_LOCALES.map((other) => ({
            href: pathFor(other.locale),
            hreflang: other.hreflang,
            label: other.shortLabel,
            isCurrent: other.locale === locale,
        })),
    };
};

const breadcrumbJsonLd = (crumbs: { name: string; url: string }[]) => ({
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
    })),
});

const organizationJsonLd = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Therr, Inc.',
    url: 'https://www.therr.app/',
};

/**
 * The FAQ in render order. The FAQPage JSON-LD is built from this same list, so the marked-up
 * answers are the visible ones by construction — Google ignores (and can penalise) FAQ markup
 * whose answers are not on the page.
 */
const buildFaq = (copy: HabitsChallengeCopy, challenge: ChallengeCopy, days: HabitsChallengeLength, vars: Record<string, string | number>) => {
    const shared = copy.ui.faqShared;
    const longForm = challenge.longForm?.[lengthKey(days)];
    return [
        ...challenge.faq,
        ...(longForm ? [longForm.faq] : []),
        copy.lengths[lengthKey(days)].faq,
        shared.missDay,
        shared.noFriend,
        shared.bothNeedApp,
        shared.isFree,
    ].map((entry) => ({ question: fill(entry.question, vars), answer: fill(entry.answer, vars) }));
};

/**
 * Day ranges for the four phases, scaled to the length: the first three days are always their
 * own phase (that is where a plan has to exist), and the finish is the last fifth.
 */
export const getPhaseRanges = (days: HabitsChallengeLength) => {
    const earlyEnd = Math.round(days / 3);
    const middleEnd = Math.round(days * 0.8);
    return {
        start: [1, 3],
        early: [4, earlyEnd],
        middle: [earlyEnd + 1, middleEnd],
        finish: [middleEnd + 1, days],
    } as Record<'start' | 'early' | 'middle' | 'finish', [number, number]>;
};

/** Other guides to link from a page: the rest of its category first, then the catalog, four in all. */
const getRelatedTemplates = (template: IHabitsChallengeTemplate) => {
    const others = HABITS_CHALLENGE_TEMPLATES.filter((other) => other.templateKey !== template.templateKey);
    return [
        ...others.filter((other) => other.category === template.category),
        ...others.filter((other) => other.category !== template.category),
    ].slice(0, 4);
};

/** Everything habits/challenge-guide.hbs needs for one template, length and locale. */
export const buildHabitsChallengePageViewContext = (
    locale: HabitsLandingLocale,
    template: IHabitsChallengeTemplate,
    days: HabitsChallengeLength,
) => {
    const copy = COPY[locale];
    const challenge = getChallengeCopy(locale, template.templateKey);
    const { ui } = copy;
    const categoryName = copy.categories[template.category];
    const vars = {
        days, name: challenge.name, inAppName: challenge.inAppName, categoryName,
    };
    const path = getHabitsChallengePagePath(locale, template.templateKey, days);
    const canonicalUrl = toUrl(path);
    const heading = fill(challenge.title, vars);
    const description = fill(challenge.metaDescription, vars);
    const hubPath = HABITS_CHALLENGE_HUB_PATHS[locale];
    const lengthCopy = copy.lengths[lengthKey(days)] as { appNote: string; recommit?: { title: string; body: string } };
    const ranges = getPhaseRanges(days);
    const rules = challenge.rules.map((rule) => fill(rule, vars));
    const faq = buildFaq(copy, challenge, days, vars);
    const chrome = buildChromeContext(locale, (other) => getHabitsChallengePagePath(other, template.templateKey, days));
    const breadcrumbs = [
        { name: ui.homeLabel, url: toUrl(chrome.homePath) },
        { name: ui.hubLabel, url: toUrl(hubPath) },
        { name: heading, url: canonicalUrl },
    ];

    const cadenceStep = template.templateCadence === template.challengeCadence
        ? fill(ui.startSteps.cadenceKeep, { schedule: scheduleLabel(copy, template.challengeCadence) })
        : fill(ui.startSteps.cadenceChange, {
            templateSchedule: scheduleLabel(copy, template.templateCadence),
            schedule: scheduleLabel(copy, template.challengeCadence),
        });

    const trackerRow = (rowKey: 'you' | 'partner') => ({
        rowKey,
        label: ui.tracker[rowKey],
        cells: Array.from({ length: days }, (unused, index) => ({
            n: index + 1,
            id: `tracker-${rowKey}-${index + 1}`,
            label: `${ui.tracker[rowKey]}: ${fill(ui.tracker.dayLabel, { n: index + 1 })}`,
        })),
    });

    // The register page is English-only today. `template` lets it name the template to pick in
    // the app; `days` rides along for the sign_up event.
    const registerHref = `/register?template=${encodeURIComponent(template.templateKey)}&days=${days}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            breadcrumbJsonLd(breadcrumbs),
            organizationJsonLd,
            {
                '@type': 'Article',
                '@id': `${canonicalUrl}#article`,
                headline: heading,
                description,
                inLanguage: chrome.htmlLang,
                datePublished: HABITS_CHALLENGE_PAGES_PUBLISHED,
                dateModified: HABITS_CHALLENGE_PAGES_UPDATED,
                author: { '@id': ORGANIZATION_ID },
                publisher: { '@id': ORGANIZATION_ID },
                mainEntityOfPage: canonicalUrl,
                url: canonicalUrl,
                image: OG_IMAGE_URL,
                about: {
                    '@type': 'MobileApplication',
                    '@id': `${HABITS_ORIGIN}/#app`,
                    name: 'Friends with Habits',
                    applicationCategory: 'LifestyleApplication',
                    operatingSystem: 'Android',
                    installUrl: PLAY_STORE_URL,
                },
            },
            {
                '@type': 'HowTo',
                '@id': `${canonicalUrl}#howto`,
                name: heading,
                description,
                inLanguage: chrome.htmlLang,
                totalTime: `P${days}D`,
                step: rules.map((text, index) => ({
                    '@type': 'HowToStep',
                    position: index + 1,
                    text,
                })),
            },
            {
                '@type': 'FAQPage',
                '@id': `${canonicalUrl}#faq`,
                inLanguage: chrome.htmlLang,
                isPartOf: { '@id': `${canonicalUrl}#article` },
                mainEntity: faq.map((entry) => ({
                    '@type': 'Question',
                    name: entry.question,
                    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
                })),
            },
        ],
    };

    return {
        ...chrome,
        ui,
        title: `${heading}${ui.brandSuffix}`,
        heading,
        description,
        summary: challenge.summary,
        categoryName,
        canonicalUrl,
        hreflangAlternates: hreflangAlternates((other) => getHabitsChallengePagePath(other, template.templateKey, days)),
        breadcrumbs: breadcrumbs.slice(0, 2).map((crumb, index) => ({ label: crumb.name, href: index === 0 ? chrome.homePath : hubPath })),
        sectionTitles: {
            ...ui.sections,
            tracker: fill(ui.sections.tracker, vars),
            milestones: fill(ui.sections.milestones, vars),
        },
        intro: challenge.intro.map((paragraph) => fill(paragraph, vars)),
        lengthNote: fill(challenge.lengthNotes[lengthKey(days)] || '', vars),
        safetyNote: challenge.safetyNote ? fill(challenge.safetyNote, vars) : '',
        rules,
        phases: (['start', 'early', 'middle', 'finish'] as const).map((phase) => ({
            range: fill(ui.phaseRange, { from: ranges[phase][0], to: ranges[phase][1] }),
            title: ui.phaseTitles[phase],
            body: fill(challenge.phases[phase], vars),
        })),
        recommit: lengthCopy.recommit || null,
        milestones: (challenge.longForm?.[lengthKey(days)]?.milestones || [])
            .map((milestone) => ({ title: fill(milestone.title, vars), body: fill(milestone.body, vars) })),
        failures: challenge.failures.map((failure) => ({ title: fill(failure.title, vars), body: fill(failure.body, vars) })),
        tracker: {
            intro: ui.tracker.intro,
            goal: template.challengeCadence === 'daily'
                ? ui.tracker.goalDaily
                : fill(ui.tracker.goalWeekly, { count: template.challengeCadence }),
            ariaLabel: fill(ui.tracker.ariaLabel, vars),
            rows: [trackerRow('you'), trackerRow('partner')],
        },
        startSteps: [
            ui.startSteps.account,
            fill(ui.startSteps.pick, vars),
            cadenceStep,
            ui.startSteps.invite,
            lengthCopy.appNote,
        ],
        cta: {
            eyebrow: ui.cta.eyebrow,
            heading: ui.cta.heading,
            body: fill(ui.cta.body, vars),
            primary: ui.cta.primary,
            secondary: ui.cta.secondary,
            note: ui.cta.note,
        },
        registerHref,
        storeUrl: PLAY_STORE_URL,
        faq,
        otherLengths: template.lengths.filter((other) => other !== days).map((other) => ({
            href: getHabitsChallengePagePath(locale, template.templateKey, other),
            label: fill(ui.otherLengthLink, { days: other }),
        })),
        related: getRelatedTemplates(template).map((other) => ({
            href: getHabitsChallengePagePath(locale, other.templateKey, 30),
            label: getChallengeCopy(locale, other.templateKey).name,
            summary: getChallengeCopy(locale, other.templateKey).summary,
        })),
        // Read by the page's GA4 and tracker scripts. serialize-javascript escapes <, > and /, so
        // it is safe inside <script> via the triple-stash.
        pageDataJson: serialize({
            pagePath: path,
            locale: getLocaleConfig(locale).code,
            templateKey: template.templateKey,
            days,
        }, { isJSON: true }),
        jsonLd: serialize(jsonLd, { isJSON: true, space: 2 }),
    };
};

/** Everything habits/challenge-hub.hbs needs for one locale. */
export const buildHabitsChallengeHubViewContext = (locale: HabitsLandingLocale) => {
    const copy = COPY[locale];
    const { ui } = copy;
    const hubPath = HABITS_CHALLENGE_HUB_PATHS[locale];
    const canonicalUrl = toUrl(hubPath);
    const chrome = buildChromeContext(locale, (other) => HABITS_CHALLENGE_HUB_PATHS[other]);

    const categories = CATEGORY_ORDER
        .map((category) => ({
            category,
            name: copy.categories[category],
            items: HABITS_CHALLENGE_TEMPLATES.filter((template) => template.category === category).map((template) => {
                const challenge = getChallengeCopy(locale, template.templateKey);
                return {
                    name: challenge.name,
                    summary: challenge.summary,
                    href: getHabitsChallengePagePath(locale, template.templateKey, template.lengths[0]),
                    links: template.lengths.map((days) => ({
                        href: getHabitsChallengePagePath(locale, template.templateKey, days),
                        label: fill(ui.hub.lengthLink, { days }),
                    })),
                };
            }),
        }))
        .filter((group) => group.items.length > 0);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            breadcrumbJsonLd([
                { name: ui.homeLabel, url: toUrl(chrome.homePath) },
                { name: ui.hubLabel, url: canonicalUrl },
            ]),
            organizationJsonLd,
            {
                '@type': 'CollectionPage',
                '@id': `${canonicalUrl}#page`,
                url: canonicalUrl,
                name: ui.hub.title,
                description: ui.hub.description,
                inLanguage: chrome.htmlLang,
                publisher: { '@id': ORGANIZATION_ID },
                mainEntity: {
                    '@type': 'ItemList',
                    itemListElement: categories.flatMap((group) => group.items).flatMap((item) => item.links)
                        .map((link, index) => ({ '@type': 'ListItem', position: index + 1, url: toUrl(link.href) })),
                },
            },
        ],
    };

    return {
        ...chrome,
        ui,
        title: `${ui.hub.title}${ui.brandSuffix}`,
        description: ui.hub.description,
        canonicalUrl,
        hreflangAlternates: hreflangAlternates((other) => HABITS_CHALLENGE_HUB_PATHS[other]),
        categories,
        registerHref: '/register',
        storeUrl: PLAY_STORE_URL,
        pageDataJson: serialize({ pagePath: hubPath, locale: getLocaleConfig(locale).code }, { isJSON: true }),
        jsonLd: serialize(jsonLd, { isJSON: true, space: 2 }),
    };
};

/** Sitemap entries for every hub and guide, with their hreflang siblings. */
export const getHabitsChallengeSitemapEntries = () => Array.from(ROUTES.entries()).map(([path, match]) => ({
    loc: toUrl(path),
    lastmod: HABITS_CHALLENGE_PAGES_UPDATED,
    priority: match.kind === 'hub' ? '0.8' : '0.7',
    changefreq: 'monthly',
    alternates: match.kind === 'hub'
        ? hreflangAlternates((other) => HABITS_CHALLENGE_HUB_PATHS[other])
        : hreflangAlternates((other) => getHabitsChallengePagePath(other, match.template.templateKey, match.days)),
}));

/**
 * templateKey → its 30-day guide, for the landing page's "Popular pacts" chips. Templates
 * without a guide are absent, and their chip stays plain text.
 */
export const getHabitsChallengeLinksByTemplate = (locale: HabitsLandingLocale): Record<string, string> => HABITS_CHALLENGE_TEMPLATES
    .reduce((acc, template) => {
        acc[template.templateKey] = getHabitsChallengePagePath(locale, template.templateKey, template.lengths[0]);
        return acc;
    }, {} as Record<string, string>);

/**
 * templateKey → the template's English in-app name, for /register. That page is English-only,
 * and it tells someone arriving from a guide which template to pick once they are in the app.
 */
export const HABITS_CHALLENGE_TEMPLATE_NAMES: Record<string, string> = HABITS_CHALLENGE_TEMPLATES
    .reduce((acc, template) => {
        acc[template.templateKey] = getChallengeCopy(DEFAULT_LOCALE, template.templateKey).inAppName;
        return acc;
    }, {} as Record<string, string>);
