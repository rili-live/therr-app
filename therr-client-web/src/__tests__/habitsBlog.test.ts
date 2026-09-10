/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';

import {
    HABITS_BLOG_POSTS,
    buildHabitsBlogJsonLd,
    isHabitsBlogListPath,
    matchHabitsBlogPost,
} from '../utilities/habitsBlog';

const VIEWS_DIR = path.join(__dirname, '../views/habits');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');

describe('habits blog cross-posts', () => {
    beforeAll((done) => {
        hbs.registerPartials(PARTIALS_DIR, () => done());
    });

    describe('generated data', () => {
        it('ships at least one cross-post', () => {
            expect(HABITS_BLOG_POSTS.length).toBeGreaterThan(0);
        });

        it.each(HABITS_BLOG_POSTS.map((p) => [p.slug, p] as const))('%s carries every field the views render', (_slug, post) => {
            (['slug', 'title', 'description', 'excerpt', 'keywords', 'bodyHtml', 'date', 'dateDisplay', 'author'] as const)
                .forEach((key) => {
                    expect(typeof post[key]).toBe('string');
                    expect(post[key].trim()).not.toHaveLength(0);
                });
        });

        it('has unique, kebab-case slugs', () => {
            const slugs = HABITS_BLOG_POSTS.map((p) => p.slug);

            expect(new Set(slugs).size).toBe(slugs.length);
            slugs.forEach((slug) => expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
        });

        it('is self-canonical on habits.therr.com, never pointed at therr.app', () => {
            // The whole point of adapting rather than copying: these pages rank on
            // their own. A canonical pointing back at therr.app would make every one
            // of them unrankable and quietly waste the exercise.
            HABITS_BLOG_POSTS.forEach((post) => {
                expect(post.canonicalUrl).toBe(`https://habits.therr.com/blog/${post.slug}`);
            });
        });

        it('links out to the therr.app original', () => {
            // Reciprocal link from an already-indexed domain — habits.therr.com has
            // almost no inbound links, and this is one of the few crawl paths to it.
            HABITS_BLOG_POSTS.forEach((post) => {
                expect(post.relatedLandingUrl).toMatch(/^https:\/\/www\.therr\.app\/blog\//);
            });
        });
    });

    describe('routing', () => {
        it('matches the blog index with and without a trailing slash', () => {
            expect(isHabitsBlogListPath('/blog')).toBe(true);
            expect(isHabitsBlogListPath('/blog/')).toBe(true);
            expect(isHabitsBlogListPath('/blogs')).toBe(false);
            expect(isHabitsBlogListPath('/')).toBe(false);
        });

        it('resolves every published slug', () => {
            HABITS_BLOG_POSTS.forEach((post) => {
                expect(matchHabitsBlogPost(`/blog/${post.slug}`)).toBe(post);
                expect(matchHabitsBlogPost(`/blog/${post.slug}/`)).toBe(post);
            });
        });

        it('returns null for an unknown slug so the caller 404s', () => {
            expect(matchHabitsBlogPost('/blog/not-a-real-post')).toBeNull();
            expect(matchHabitsBlogPost('/blog')).toBeNull();
            expect(matchHabitsBlogPost('/u/someone')).toBeNull();
        });

        it('does not match traversal or nested paths', () => {
            expect(matchHabitsBlogPost('/blog/../privacy-policy')).toBeNull();
            expect(matchHabitsBlogPost('/blog/a/b')).toBeNull();
            expect(matchHabitsBlogPost('/blog/UPPER')).toBeNull();
        });
    });

    describe('JSON-LD', () => {
        it('is parseable and describes a BlogPosting at the canonical url', () => {
            const post = HABITS_BLOG_POSTS[0];
            const parsed = JSON.parse(buildHabitsBlogJsonLd(post));

            expect(parsed['@type']).toBe('BlogPosting');
            expect(parsed.url).toBe(post.canonicalUrl);
            expect(parsed.mainEntityOfPage['@id']).toBe(post.canonicalUrl);
            expect(parsed.headline).toBe(post.title);
        });

        it('survives an apostrophe in the title without HTML entities', () => {
            // Handlebars' default escaping turns ' into &#x27;, which JSON-LD parsers
            // do not decode — it silently invalidates the block. The view uses a
            // triple-stash for exactly this reason; this asserts the string it gets
            // is already script-body-safe.
            const withQuote = { ...HABITS_BLOG_POSTS[0], title: "Don't Break the Chain" };
            const json = buildHabitsBlogJsonLd(withQuote);

            expect(json).not.toContain('&#x27;');
            expect(JSON.parse(json).headline).toBe("Don't Break the Chain");
        });
    });

    describe('views', () => {
        const render = (view: string, context: Record<string, unknown>): string => hbs.handlebars
            .compile(fs.readFileSync(path.join(VIEWS_DIR, view), 'utf8'))(context);

        it('blog-list renders one entry per post, linked by slug', () => {
            const html = render('blog-list.hbs', {
                title: 'Notes',
                description: 'desc',
                canonicalUrl: 'https://habits.therr.com/blog',
                posts: HABITS_BLOG_POSTS,
            });

            HABITS_BLOG_POSTS.forEach((post) => {
                expect(html).toContain(`href="/blog/${post.slug}"`);
                expect(html).toContain(post.title);
            });
        });

        it('blog-post renders the article body as markup, not escaped text', () => {
            const post = HABITS_BLOG_POSTS[0];
            const html = render('blog-post.hbs', {
                title: `${post.title} — Friends with Habits`,
                postTitle: post.title,
                description: post.description,
                keywords: post.keywords,
                canonicalUrl: post.canonicalUrl,
                date: post.date,
                dateDisplay: post.dateDisplay,
                author: post.author,
                bodyHtml: post.bodyHtml,
                relatedLandingUrl: post.relatedLandingUrl,
                jsonLd: buildHabitsBlogJsonLd(post),
            });

            expect(html).toContain('<h2>');
            expect(html).not.toContain('&lt;h2&gt;');
            expect(html).toContain(`<link rel="canonical" href="${post.canonicalUrl}">`);
            expect(html).toContain(post.relatedLandingUrl);
        });

        it('blog-post embeds JSON-LD that still parses after templating', () => {
            const post = HABITS_BLOG_POSTS[0];
            const html = render('blog-post.hbs', {
                postTitle: post.title,
                canonicalUrl: post.canonicalUrl,
                bodyHtml: post.bodyHtml,
                jsonLd: buildHabitsBlogJsonLd(post),
            });

            const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
            expect(block).not.toBeNull();
            expect(() => JSON.parse((block as RegExpMatchArray)[1])).not.toThrow();
        });

        it.each(['blog-list.hbs', 'blog-post.hbs'])('%s carries analytics and the shared footer', (view) => {
            const source = fs.readFileSync(path.join(VIEWS_DIR, view), 'utf8');

            expect(source).toContain('{{> habitsAnalytics}}');
            expect(source).toContain('{{> habitsFooter}}');
        });
    });
});
