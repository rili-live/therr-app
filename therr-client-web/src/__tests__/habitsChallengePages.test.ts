/**
 * @jest-environment jsdom
 */

import fs from 'fs';
import path from 'path';
import hbs from 'hbs';
import {
    HABITS_CHALLENGE_HUB_PATHS,
    HABITS_CHALLENGE_PAGES_UPDATED,
    HABITS_CHALLENGE_PATHS,
    HABITS_CHALLENGE_TEMPLATES,
    HABITS_CHALLENGE_TEMPLATE_NAMES,
    HabitsChallengeLength,
    buildHabitsChallengeHubViewContext,
    buildHabitsChallengePageViewContext,
    getHabitsChallengeLinksByTemplate,
    getHabitsChallengePagePath,
    getHabitsChallengeSitemapEntries,
    getPhaseRanges,
    matchHabitsChallengePath,
} from '../utilities/habitsChallengePages';
import { HABITS_LANDING_LOCALES, buildHabitsLandingViewContext } from '../utilities/habitsLanding';
import { CHALLENGE_PATH_RE } from '../utilities/habitsChallenge';

/**
 * Guards for the programmatic challenge guides (habits.therr.com/challenges/...).
 *
 * What these protect is invisible in a build: a renamed slug throws away everything Search
 * Console learned about a URL, an incomplete hreflang set is ignored outright, FAQ markup whose
 * answers are not on the page is discarded, and a page that is mostly another page with a number
 * swapped drags the whole subdomain down. None of it fails anywhere but here.
 */
const VIEWS_DIR = path.join(__dirname, '../views/habits');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');
const MIGRATIONS_DIR = path.join(__dirname, '../../../therr-services/users-service/src/store/migrations');

// Registered synchronously so the it.each tables below can be built from rendered output.
fs.readdirSync(PARTIALS_DIR)
    .filter((file) => file.endsWith('.hbs'))
    .forEach((file) => {
        hbs.handlebars.registerPartial(path.basename(file, '.hbs'), fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8'));
    });

const guideTemplate = hbs.handlebars.compile(fs.readFileSync(path.join(VIEWS_DIR, 'challenge-guide.hbs'), 'utf8'));
const hubTemplate = hbs.handlebars.compile(fs.readFileSync(path.join(VIEWS_DIR, 'challenge-hub.hbs'), 'utf8'));
const landingTemplate = hbs.handlebars.compile(fs.readFileSync(path.join(VIEWS_DIR, 'landing.hbs'), 'utf8'));

const LOCALES = HABITS_LANDING_LOCALES.map((config) => config.locale);

const PAGES = LOCALES.flatMap((locale) => HABITS_CHALLENGE_TEMPLATES.flatMap((template) => template.lengths
    .map((days) => ({ locale, template, days }))));

const renderPage = ({ locale, template, days }: typeof PAGES[number]) => guideTemplate(
    buildHabitsChallengePageViewContext(locale, template, days),
);

const getJsonLd = (html: string) => {
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!match) {
        throw new Error('No JSON-LD block found');
    }
    return JSON.parse(match[1]);
};

/** The page's visible text, as a reader (or a crawler's main-content pass) sees it. */
const visibleText = (html: string) => html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const shingles = (text: string) => {
    const words = text.toLowerCase().split(' ');
    const set = new Set<string>();
    for (let i = 0; i + 5 <= words.length; i += 1) {
        set.add(words.slice(i, i + 5).join(' '));
    }
    return set;
};

const jaccard = (a: Set<string>, b: Set<string>) => {
    let shared = 0;
    a.forEach((item) => { if (b.has(item)) shared += 1; });
    return shared / (a.size + b.size - shared);
};

const pageLabel = (page: typeof PAGES[number]) => `${page.locale} ${page.template.templateKey} ${page.days}`;

describe('habits challenge guides: URLs', () => {
    it('serves exactly the pinned paths — slugs are permanent', () => {
        // Search Console's history is keyed on the URL. If this fails because you renamed a slug,
        // put the old one back and add the new page alongside it instead.
        expect([...HABITS_CHALLENGE_PATHS].sort()).toEqual([
            '/challenges',
            '/challenges/30-day-no-spend',
            '/challenges/90-day-no-spend',
            '/challenges/30-day-10000-steps',
            '/challenges/60-day-10000-steps',
            '/challenges/30-day-workout',
            '/challenges/90-day-workout',
            '/challenges/30-day-running',
            '/challenges/60-day-running',
            '/challenges/30-day-no-sugar',
            '/challenges/60-day-no-sugar',
            '/challenges/30-day-alcohol-free',
            '/challenges/90-day-alcohol-free',
            '/challenges/30-day-cold-shower',
            '/challenges/60-day-cold-shower',
            '/challenges/30-day-water',
            '/challenges/30-day-meditation',
            '/challenges/60-day-meditation',
            '/challenges/30-day-journaling',
            '/challenges/30-day-reading',
            '/challenges/90-day-reading',
            '/challenges/30-day-screen-time',
            '/es/retos',
            '/es/retos/30-dias-sin-gastar',
            '/es/retos/90-dias-sin-gastar',
            '/es/retos/30-dias-10000-pasos',
            '/es/retos/60-dias-10000-pasos',
            '/es/retos/30-dias-ejercicio',
            '/es/retos/90-dias-ejercicio',
            '/es/retos/30-dias-correr',
            '/es/retos/60-dias-correr',
            '/es/retos/30-dias-sin-azucar',
            '/es/retos/60-dias-sin-azucar',
            '/es/retos/30-dias-sin-alcohol',
            '/es/retos/90-dias-sin-alcohol',
            '/es/retos/30-dias-ducha-fria',
            '/es/retos/60-dias-ducha-fria',
            '/es/retos/30-dias-agua',
            '/es/retos/30-dias-meditacion',
            '/es/retos/60-dias-meditacion',
            '/es/retos/30-dias-diario',
            '/es/retos/30-dias-lectura',
            '/es/retos/90-dias-lectura',
            '/es/retos/30-dias-tiempo-de-pantalla',
            '/fr/defis',
            '/fr/defis/30-jours-sans-depenser',
            '/fr/defis/90-jours-sans-depenser',
            '/fr/defis/30-jours-10000-pas',
            '/fr/defis/60-jours-10000-pas',
            '/fr/defis/30-jours-entrainement',
            '/fr/defis/90-jours-entrainement',
            '/fr/defis/30-jours-course-a-pied',
            '/fr/defis/60-jours-course-a-pied',
            '/fr/defis/30-jours-sans-sucre',
            '/fr/defis/60-jours-sans-sucre',
            '/fr/defis/30-jours-sans-alcool',
            '/fr/defis/90-jours-sans-alcool',
            '/fr/defis/30-jours-douche-froide',
            '/fr/defis/60-jours-douche-froide',
            '/fr/defis/30-jours-eau',
            '/fr/defis/30-jours-meditation',
            '/fr/defis/60-jours-meditation',
            '/fr/defis/30-jours-journal',
            '/fr/defis/30-jours-lecture',
            '/fr/defis/90-jours-lecture',
            '/fr/defis/30-jours-temps-d-ecran',
        ].sort());
    });

    it('uses only lowercase ASCII, digits and hyphens in every path', () => {
        HABITS_CHALLENGE_PATHS.forEach((pagePath) => expect(pagePath).toMatch(/^(\/[a-z0-9]+(-[a-z0-9]+)*)+$/));
    });

    it('matches every path, with or without a trailing slash, to the right locale', () => {
        LOCALES.forEach((locale) => {
            expect(matchHabitsChallengePath(HABITS_CHALLENGE_HUB_PATHS[locale])).toEqual({ kind: 'hub', locale });
            expect(matchHabitsChallengePath(`${HABITS_CHALLENGE_HUB_PATHS[locale]}/`)).toEqual({ kind: 'hub', locale });
        });
        const match = matchHabitsChallengePath('/es/retos/30-dias-sin-gastar/');
        expect(match).toMatchObject({
            kind: 'page', locale: 'es', days: 30, template: { templateKey: 'noSpendDay' },
        });
    });

    it('returns null for an unknown slug, an unsupported length or a page under the wrong locale', () => {
        ['/challenges/30-day-nothing', '/challenges/45-day-no-spend', '/challenges/7-day-no-spend',
            '/es/retos/30-day-no-spend', '/fr/defis/30-dias-sin-gastar', '/challenges/30-day-no-spend/extra',
            '/Challenges', '/', '/es', '/fr'].forEach((unknown) => expect(matchHabitsChallengePath(unknown)).toBeNull());
    });

    it('never collides with a join-by-link challenge (/c/:token)', () => {
        HABITS_CHALLENGE_PATHS.forEach((pagePath) => expect(pagePath).not.toMatch(CHALLENGE_PATH_RE));
    });
});

describe('habits challenge guides: catalog', () => {
    // The guides send people to a template by name. If the template does not exist, or sits in a
    // different picker category, "pick X under Y" is a promise the app breaks on first open.
    const seedSource = fs.readdirSync(MIGRATIONS_DIR)
        .filter((file) => /habit_goals\.seed.*Templates\.js$/.test(file))
        .map((file) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
        .join('\n');

    it.each(HABITS_CHALLENGE_TEMPLATES.map((template) => [template.templateKey, template] as const))(
        '%s is a seeded template in the category and with the cadence the page states',
        (templateKey, template) => {
            // The seed rows read `templateKey`, then `category`, then a `...daily` / `...perWeek(N)` spread.
            const seedRow = `templateKey: '${templateKey}',[\\s\\S]*?category: '(\\w+)',[\\s\\S]*?\\.\\.\\.(daily|perWeek\\((\\d)\\))`;
            const match = seedSource.match(new RegExp(seedRow));
            expect(match).not.toBeNull();
            const [, category, cadence, perWeek] = match as RegExpMatchArray;
            expect(category).toBe(template.category);
            expect(cadence === 'daily' ? 'daily' : Number(perWeek)).toBe(template.templateCadence);
        },
    );

    it('only offers lengths a pact can honestly run (one, two or three 30-day cycles)', () => {
        HABITS_CHALLENGE_TEMPLATES.forEach((template) => {
            expect(template.lengths[0]).toBe(30);
            template.lengths.forEach((days) => expect([30, 60, 90]).toContain(days));
        });
    });

    it('names every catalog template for /register, and nothing else', () => {
        expect(Object.keys(HABITS_CHALLENGE_TEMPLATE_NAMES).sort())
            .toEqual(HABITS_CHALLENGE_TEMPLATES.map((template) => template.templateKey).sort());
    });

    it('splits a length into four phases that tile it from day 1 to the last day', () => {
        ([30, 60, 90] as HabitsChallengeLength[]).forEach((days) => {
            const ranges = getPhaseRanges(days);
            const order = [ranges.start, ranges.early, ranges.middle, ranges.finish];
            expect(order[0][0]).toBe(1);
            expect(order[3][1]).toBe(days);
            order.forEach(([from, to], index) => {
                expect(to).toBeGreaterThanOrEqual(from);
                if (index > 0) expect(from).toBe(order[index - 1][1] + 1);
            });
        });
    });
});

describe.each(PAGES.map((page) => [pageLabel(page), page] as const))('challenge guide %s', (_label, page) => {
    const html = renderPage(page);
    const context = buildHabitsChallengePageViewContext(page.locale, page.template, page.days);
    const pagePath = getHabitsChallengePagePath(page.locale, page.template.templateKey, page.days);

    it('has a page-specific title, description and self-canonical URL', () => {
        expect(html).toContain(`<link rel="canonical" href="https://habits.therr.com${pagePath}">`);
        expect(context.title).toContain(String(page.days));
        expect(context.title).toMatch(/\| Friends with Habits$/);
        expect(context.description.length).toBeGreaterThan(80);
        // Longer descriptions are cut mid-sentence on the results page.
        expect(context.description.length).toBeLessThanOrEqual(160);
        expect(html).toMatch(/<meta name="description" content="[^"]{80,}">/);
    });

    it('carries the og and twitter tags', () => {
        ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].forEach((property) => {
            expect(html).toContain(`<meta property="${property}"`);
        });
        ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].forEach((name) => {
            expect(html).toContain(`<meta name="${name}"`);
        });
    });

    it('links all three languages and x-default, each pointing at the same guide', () => {
        const alternates = Array.from(html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g))
            .map(([, hreflang, href]) => [hreflang, href]);
        expect(alternates).toEqual([
            ['en', `https://habits.therr.com${getHabitsChallengePagePath('en-us', page.template.templateKey, page.days)}`],
            ['es', `https://habits.therr.com${getHabitsChallengePagePath('es', page.template.templateKey, page.days)}`],
            ['fr', `https://habits.therr.com${getHabitsChallengePagePath('fr-ca', page.template.templateKey, page.days)}`],
            ['x-default', `https://habits.therr.com${getHabitsChallengePagePath('en-us', page.template.templateKey, page.days)}`],
        ]);
    });

    it('declares Article, HowTo, FAQPage and BreadcrumbList structured data', () => {
        const types = getJsonLd(html)['@graph'].map((node) => node['@type']);
        expect(types).toEqual(expect.arrayContaining(['Article', 'HowTo', 'FAQPage', 'BreadcrumbList']));
        const howTo = getJsonLd(html)['@graph'].find((node) => node['@type'] === 'HowTo');
        expect(howTo.totalTime).toBe(`P${page.days}D`);
    });

    it('marks up only FAQ answers that are visible on the page', () => {
        const text = visibleText(html);
        const faq = getJsonLd(html)['@graph'].find((node) => node['@type'] === 'FAQPage');
        expect(faq.mainEntity.length).toBeGreaterThanOrEqual(7);
        faq.mainEntity.forEach((entry) => {
            expect(text).toContain(entry.name);
            expect(text).toContain(entry.acceptedAnswer.text);
        });
    });

    it('renders a tracker with a box per day for you and your partner', () => {
        expect(html.match(/<input type="checkbox" id="tracker-you-\d+"/g)).toHaveLength(page.days);
        expect(html.match(/<input type="checkbox" id="tracker-partner-\d+"/g)).toHaveLength(page.days);
    });

    it('sends the primary CTA to /register with the template, and the secondary to the Habits Play listing', () => {
        // Handlebars entity-escapes `=` and `&` in attributes; browsers decode both.
        expect(html).toContain(`href="/register?template&#x3D;${page.template.templateKey}&amp;days&#x3D;${page.days}"`);
        expect(html).toContain('href="https://play.google.com/store/apps/details?id=com.therr.habits"');
        expect(html).not.toContain('app.therrmobile');
    });

    it('leaves no placeholder unfilled', () => {
        expect(visibleText(html)).not.toMatch(/\{[a-zA-Z]+\}/);
        expect(html).not.toMatch(/\{(days|name|inAppName|categoryName|count|from|to|n)\}/);
    });

    it('never names a trademarked program', () => {
        // docs/ADJACENCY_MARKETING.md § Rules: behaviours, never branded programs.
        expect(visibleText(html)).not.toMatch(/75\s*hard|dry january|sober october|whole\s*30|couch to 5k|c25k|atomic habits/i);
    });

    it('links the hub, the other lengths and related guides', () => {
        expect(html).toContain(`href="${HABITS_CHALLENGE_HUB_PATHS[page.locale]}"`);
        page.template.lengths.filter((days) => days !== page.days).forEach((days) => {
            expect(html).toContain(`href="${getHabitsChallengePagePath(page.locale, page.template.templateKey, days)}"`);
        });
        expect(context.related).toHaveLength(4);
    });

    it('has more than a thousand words of its own', () => {
        expect(visibleText(html).split(' ').length).toBeGreaterThan(1000);
    });
});

describe('habits challenge guides: duplication', () => {
    // Shingle overlap of the visible text. Between different challenges it is the shared chrome and
    // shared FAQ; between two lengths of one challenge it is the core how-to, offset by the
    // length's own milestones and FAQ. If the second number climbs, the long versions are
    // becoming copies of the 30-day page: write them more of their own, or drop them.
    it.each(LOCALES)('keeps %s pages distinct from one another', (locale) => {
        const pages = PAGES.filter((page) => page.locale === locale)
            .map((page) => ({ page, set: shingles(visibleText(renderPage(page))) }));
        let maxAcrossChallenges = 0;
        let maxAcrossLengths = 0;
        pages.forEach((a, i) => pages.slice(i + 1).forEach((b) => {
            const overlap = jaccard(a.set, b.set);
            if (a.page.template === b.page.template) {
                maxAcrossLengths = Math.max(maxAcrossLengths, overlap);
            } else {
                maxAcrossChallenges = Math.max(maxAcrossChallenges, overlap);
            }
        }));
        expect(maxAcrossChallenges).toBeLessThan(0.45);
        expect(maxAcrossLengths).toBeLessThan(0.72);
    });
});

describe.each(LOCALES)('challenge hub (%s)', (locale) => {
    const context = buildHabitsChallengeHubViewContext(locale);
    const html = hubTemplate(context);

    it('links every guide in its language', () => {
        HABITS_CHALLENGE_TEMPLATES.forEach((template) => template.lengths.forEach((days) => {
            expect(html).toContain(`href="${getHabitsChallengePagePath(locale, template.templateKey, days)}"`);
        }));
    });

    it('is self-canonical with a full hreflang set', () => {
        expect(html).toContain(`<link rel="canonical" href="https://habits.therr.com${HABITS_CHALLENGE_HUB_PATHS[locale]}">`);
        expect(html.match(/<link rel="alternate" hreflang=/g)).toHaveLength(4);
        expect(html).toContain('hreflang="x-default" href="https://habits.therr.com/challenges"');
    });

    it('declares a parseable CollectionPage listing every guide', () => {
        const page = getJsonLd(html)['@graph'].find((node) => node['@type'] === 'CollectionPage');
        const guideCount = HABITS_CHALLENGE_TEMPLATES.reduce((sum, template) => sum + template.lengths.length, 0);
        expect(page.mainEntity.itemListElement).toHaveLength(guideCount);
    });

    it('uses the localized footer, with the hub link', () => {
        expect(html).toContain(`<a href="${HABITS_CHALLENGE_HUB_PATHS[locale]}">`);
    });
});

describe('habits challenge guides: discovery', () => {
    it('lists every guide and hub in the sitemap, dated by content and with its hreflang siblings', () => {
        const entries = getHabitsChallengeSitemapEntries();
        expect(entries.map((entry) => entry.loc).sort())
            .toEqual(HABITS_CHALLENGE_PATHS.map((pagePath) => `https://habits.therr.com${pagePath}`).sort());
        entries.forEach((entry) => {
            expect(entry.lastmod).toBe(HABITS_CHALLENGE_PAGES_UPDATED);
            expect(entry.alternates.map((alternate) => alternate.hreflang)).toEqual(['en', 'es', 'fr', 'x-default']);
            expect(entry.alternates.map((alternate) => alternate.href)).toContain(entry.loc);
        });
    });

    it.each(LOCALES)('links the hub from the shared footer on the %s landing page', (locale) => {
        const html = landingTemplate({
            ...buildHabitsLandingViewContext(locale, { freeHabitLimit: 3 }),
            popularChallengeLinks: getHabitsChallengeLinksByTemplate(locale),
        });
        expect(html).toContain(`<a href="${HABITS_CHALLENGE_HUB_PATHS[locale]}">`);
    });

    it.each(LOCALES)('links each popular-pact chip that has a guide on the %s landing page', (locale) => {
        const links = getHabitsChallengeLinksByTemplate(locale);
        const html = landingTemplate({
            ...buildHabitsLandingViewContext(locale, { freeHabitLimit: 3 }),
            popularChallengeLinks: links,
        });
        const chips = buildHabitsLandingViewContext(locale, { freeHabitLimit: 3 }).t.popular.pacts;
        Object.keys(chips).forEach((templateKey) => {
            if (links[templateKey]) {
                expect(html).toContain(`<a href="${links[templateKey]}">${chips[templateKey]}</a>`);
            } else {
                expect(html).toContain(`<li>${chips[templateKey]}</li>`);
            }
        });
        // At least the step, cold-shower, no-sugar and alcohol-free chips have guides.
        expect(Object.keys(chips).filter((templateKey) => links[templateKey]).length).toBeGreaterThanOrEqual(4);
    });

    it('still renders the chips as plain text when no links are passed', () => {
        const html = landingTemplate(buildHabitsLandingViewContext('en-us', { freeHabitLimit: 3 }));
        expect(html).not.toContain('pact-chip--link"><a');
        expect(html).toContain('<ul class="pact-chips"');
    });
});
