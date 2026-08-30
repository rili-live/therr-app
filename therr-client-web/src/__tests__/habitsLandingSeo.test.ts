/**
 * @jest-environment jsdom
 */

import fs from 'fs';
import path from 'path';

/**
 * Structural SEO/GEO guards for the Friends with Habits landing page.
 *
 * These assert the things that break silently: Google demotes (and can penalise)
 * FAQPage markup whose answers are not visible on the page, and a malformed
 * JSON-LD block is simply dropped by every consumer with no error surfaced
 * anywhere. Neither shows up in a build, a lint, or a render test.
 *
 * The template is read as text rather than rendered because the only Handlebars
 * expressions in it are `{{title}}`/`{{description}}`/`{{canonicalUrl}}` in the
 * head — every assertion below is on static markup.
 */
const TEMPLATE_PATH = path.join(__dirname, '../views/habits/landing.hbs');
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '');

const getJsonLd = () => {
    const match = template.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!match) {
        throw new Error('No JSON-LD block found in habits/landing.hbs');
    }
    return JSON.parse(match[1]);
};

describe('habits landing page SEO markup', () => {
    it('embeds a parseable JSON-LD graph', () => {
        expect(() => getJsonLd()).not.toThrow();
        expect(getJsonLd()['@graph']).toEqual(expect.any(Array));
    });

    it('declares the node types search and answer engines read', () => {
        const types = getJsonLd()['@graph'].map((node) => node['@type']);
        expect(types).toEqual(expect.arrayContaining([
            'WebSite', 'Organization', 'WebPage', 'MobileApplication', 'FAQPage',
        ]));
    });

    it('attributes the app to the same Organization node declared on www.therr.app', () => {
        // The cross-domain @id is what merges habits.therr.com and www.therr.app into
        // one company entity. A typo here silently splits them back into two.
        const app = getJsonLd()['@graph'].find((node) => node['@type'] === 'MobileApplication');
        expect(app.publisher['@id']).toBe('https://www.therr.app/#organization');
    });

    it('points install links at the Habits application id, not the Therr app', () => {
        // app.therrmobile installs an app that cannot open a Friends with Habits account.
        const app = getJsonLd()['@graph'].find((node) => node['@type'] === 'MobileApplication');
        expect(app.installUrl).toContain('id=com.therr.habits');
        // Scoped to hrefs: the template names app.therrmobile in a comment explaining
        // why it must not be linked.
        const playStoreHrefs = template.match(/href="https:\/\/play\.google\.com[^"]*"/g) || [];
        expect(playStoreHrefs.length).toBeGreaterThan(0);
        playStoreHrefs.forEach((href) => expect(href).toContain('id=com.therr.habits'));
    });

    describe('FAQPage markup matches the visible copy', () => {
        const faq = getJsonLd()['@graph'].find((node) => node['@type'] === 'FAQPage');
        const visibleText = stripTags(template);

        it.each(faq.mainEntity.map((entry) => [entry.name, entry.acceptedAnswer.text]))(
            '%s',
            (question, answer) => {
                expect(visibleText).toContain(question);
                expect(visibleText).toContain(answer);
            },
        );
    });

    it('has exactly one h1', () => {
        expect(template.match(/<h1[\s>]/g)).toHaveLength(1);
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
