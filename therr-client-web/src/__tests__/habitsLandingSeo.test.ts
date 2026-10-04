/**
 * @jest-environment jsdom
 */

import fs from 'fs';
import path from 'path';
import hbs from 'hbs';
import {
    HABITS_LANDING_LOCALES,
    HabitsLandingLocale,
    buildHabitsLandingViewContext,
} from '../utilities/habitsLanding';

/**
 * Structural SEO/GEO guards for the Friends with Habits landing page, in every language
 * it is served in ('/', '/es', '/fr').
 *
 * These assert the things that break silently: Google demotes (and can penalise)
 * FAQPage markup whose answers are not visible on the page, a malformed JSON-LD block
 * is simply dropped by every consumer with no error surfaced anywhere, and an
 * incomplete hreflang set is ignored outright. None of it shows up in a build or a lint.
 *
 * Each locale is rendered through Handlebars with the context the server builds, because
 * the copy (and the JSON-LD built from it) now comes from src/habitsLocales.
 */
const TEMPLATE_PATH = path.join(__dirname, '../views/habits/landing.hbs');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

// Registered synchronously (hbs.registerPartials is async) so it.each tables below can be
// built from rendered output at collection time.
fs.readdirSync(PARTIALS_DIR)
    .filter((file) => file.endsWith('.hbs'))
    .forEach((file) => {
        hbs.handlebars.registerPartial(path.basename(file, '.hbs'), fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8'));
    });

const compiled = hbs.handlebars.compile(template);
const render = (locale: HabitsLandingLocale) => compiled({
    ...buildHabitsLandingViewContext(locale, { freeHabitLimit: 3 }),
    apiBaseJson: '"https://api.test.therr.com/v1"',
});

const LOCALES = HABITS_LANDING_LOCALES.map((config) => config.locale);

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '');

const getJsonLd = (html: string) => {
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!match) {
        throw new Error('No JSON-LD block found in rendered habits/landing.hbs');
    }
    return JSON.parse(match[1]);
};

describe.each(LOCALES)('habits landing page SEO markup (%s)', (locale) => {
    const html = render(locale);
    const config = HABITS_LANDING_LOCALES.find((entry) => entry.locale === locale) as typeof HABITS_LANDING_LOCALES[number];

    it('embeds a parseable JSON-LD graph', () => {
        expect(() => getJsonLd(html)).not.toThrow();
        expect(getJsonLd(html)['@graph']).toEqual(expect.any(Array));
    });

    it('declares the node types search and answer engines read', () => {
        const types = getJsonLd(html)['@graph'].map((node) => node['@type']);
        expect(types).toEqual(expect.arrayContaining([
            'WebSite', 'Organization', 'WebPage', 'MobileApplication', 'FAQPage',
        ]));
    });

    it('attributes the app to the same Organization node declared on www.therr.app', () => {
        // The cross-domain @id is what merges habits.therr.com and www.therr.app into
        // one company entity. A typo here silently splits them back into two.
        const app = getJsonLd(html)['@graph'].find((node) => node['@type'] === 'MobileApplication');
        expect(app.publisher['@id']).toBe('https://www.therr.app/#organization');
    });

    it('points install links at the Habits application id, not the Therr app', () => {
        // app.therrmobile installs an app that cannot open a Friends with Habits account.
        const app = getJsonLd(html)['@graph'].find((node) => node['@type'] === 'MobileApplication');
        expect(app.installUrl).toContain('id=com.therr.habits');
        // Scoped to hrefs: the template names app.therrmobile in a comment explaining
        // why it must not be linked.
        const playStoreHrefs = html.match(/href="https:\/\/play\.google\.com[^"]*"/g) || [];
        expect(playStoreHrefs.length).toBeGreaterThan(0);
        playStoreHrefs.forEach((href) => expect(href).toContain('id=com.therr.habits'));
    });

    describe('FAQPage markup matches the visible copy', () => {
        const faq = getJsonLd(html)['@graph'].find((node) => node['@type'] === 'FAQPage');
        const visibleText = stripTags(html);

        it('has every question', () => {
            expect(faq.mainEntity).toHaveLength(8);
        });

        it.each(faq.mainEntity.map((entry) => [entry.name, entry.acceptedAnswer.text]))(
            '%s',
            (question, answer) => {
                expect(visibleText).toContain(question);
                expect(visibleText).toContain(answer);
            },
        );
    });

    it('renders the brand motto and keeps the JSON-LD slogans byte-identical to it', () => {
        // The motto is written in three places (visible copy, WebSite.slogan,
        // MobileApplication.slogan). All three now come from one dictionary key; this
        // guards the wiring.
        const motto = config.copy.hero.motto;
        expect(html).toContain(`<p class="motto">${motto}</p>`);

        const slogans = getJsonLd(html)['@graph']
            .filter((node) => node.slogan)
            .map((node) => node.slogan);
        expect(slogans).toHaveLength(2);
        slogans.forEach((slogan) => expect(slogan).toBe(motto));
    });

    it('keeps the motto out of the h1', () => {
        // The headline has to carry the head term this page ranks for; the motto is
        // additive brand copy and must not displace it.
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        if (!h1) {
            throw new Error('No h1 found in habits/landing.hbs');
        }
        expect(h1[1]).not.toContain(config.copy.hero.motto);
        expect(stripTags(h1[1]).trim().length).toBeGreaterThan(0);
    });

    it('has exactly one h1', () => {
        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    });

    it('declares its own language on the document and in the structured data', () => {
        expect(html).toContain(`<html lang="${config.htmlLang}">`);
        expect(html).toContain(`<meta property="og:locale" content="${config.ogLocale}">`);
        getJsonLd(html)['@graph']
            .filter((node) => node.inLanguage)
            .forEach((node) => expect(node.inLanguage).toBe(config.htmlLang));
    });

    it('lists every language, and x-default, as an hreflang alternate', () => {
        // Google ignores an hreflang set that is not complete and reciprocal on every page.
        const alternates = (html.match(/<link rel="alternate" hreflang="[^"]+" href="[^"]+">/g) || []);
        expect(alternates).toEqual([
            '<link rel="alternate" hreflang="en" href="https://habits.therr.com">',
            '<link rel="alternate" hreflang="es" href="https://habits.therr.com/es">',
            '<link rel="alternate" hreflang="fr" href="https://habits.therr.com/fr">',
            '<link rel="alternate" hreflang="x-default" href="https://habits.therr.com">',
        ]);
        expect(html).toContain(`<link rel="canonical" href="https://habits.therr.com${config.path === '/' ? '' : config.path}">`);
    });

    it('offers a switch to every language, marking the current one', () => {
        LOCALES.forEach((other) => {
            const otherConfig = HABITS_LANDING_LOCALES.find((entry) => entry.locale === other) as typeof config;
            expect(html).toContain(`href="${otherConfig.path}?lang=${otherConfig.code}"`);
        });
        expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    });

    it('leaves no placeholder or missing copy behind', () => {
        // A missing dictionary key renders as an empty string, and an uninterpolated
        // variable as a literal {name}; both are invisible to every other check here.
        const body = (html.match(/<main>[\s\S]*<\/main>/) as RegExpMatchArray)[0];
        expect(stripTags(body)).not.toMatch(/\{[a-zA-Z]+\}/);
        expect(body).not.toMatch(/<(h1|h2|h3|p|li|span|div)[^>]*>\s*<\/\1>/);
        // The free-tier cap is interpolated from HABITS_FREE_HABIT_LIMIT, not hardcoded.
        const founderList = (body.match(/<ul class="founder-list">[\s\S]*?<\/ul>/) as RegExpMatchArray)[0];
        expect(stripTags(founderList)).toMatch(/\b3\b/);
    });

    it('allows every third-party image host it embeds through the CSP', () => {
        // Helmet's CSP is only applied outside development, so an img-src omission
        // renders fine locally and breaks the image in production silently.
        const serverClient = fs.readFileSync(path.join(__dirname, '../server-client.tsx'), 'utf8');
        const imgSrcBlock = serverClient.match(/imgSrc: \[([\s\S]*?)\],/);
        if (!imgSrcBlock) {
            throw new Error('No imgSrc directive found in the server-client.tsx CSP');
        }

        const allowedSources = (imgSrcBlock[1].match(/'([^']+)'/g) || []).map((entry) => entry.slice(1, -1));
        const isAllowed = (host: string) => allowedSources.some((source) => {
            const sourceHost = source.replace(/^https:\/\//, '');
            return sourceHost.startsWith('*.')
                ? host === sourceHost.slice(2) || host.endsWith(sourceHost.slice(1))
                : host === sourceHost;
        });

        // Scoped to <img>/<source>: a <script src> or an <iframe src> is governed by a
        // different CSP directive, so demanding those appear in imgSrc would be wrong.
        const externalImageHosts = new Set<string>();
        (template.match(/<(?:img|source)\b[^>]*>/g) || []).forEach((tag) => {
            (tag.match(/(?:src|srcset)="[^"]*"/g) || []).forEach((attribute) => {
                const value = attribute.replace(/^[a-z]+="/, '').replace(/"$/, '');
                // A srcset holds comma-separated candidates, each "<url> [descriptor]".
                value.split(',').forEach((candidate) => {
                    const url = candidate.trim().split(/\s+/)[0];
                    if (url.indexOf('https://') === 0) {
                        externalImageHosts.add(url.slice('https://'.length).split('/')[0]);
                    }
                });
            });
        });
        expect(externalImageHosts.size).toBeGreaterThan(0);
        externalImageHosts.forEach((host) => expect({ host, isAllowed: isAllowed(host) }).toEqual({ host, isAllowed: true }));
    });

    it('links the LaunchKiwi badge with a theme-aware source', () => {
        expect(template).toContain('href="https://launchkiwi.com/p/friends-with-habits"');
        expect(template).toContain('srcset="https://launchkiwi.com/badge-dark.svg" media="(prefers-color-scheme: dark)"');
        expect(template).toContain('src="https://launchkiwi.com/badge-light.svg"');
    });

    it('ships an absolute, correctly-sized Open Graph image', () => {
        // A summary_large_image card with no og:image renders as a blank link preview.
        expect(template).toContain('<meta property="og:image" content="https://habits.therr.com/assets/images/habits-og-image.png">');
        expect(template).toContain('<meta property="og:image:width" content="1200">');
        expect(template).toContain('<meta property="og:image:height" content="630">');
        expect(fs.existsSync(path.join(__dirname, '../_static/assets/images/habits-og-image.png'))).toBe(true);
    });
});
