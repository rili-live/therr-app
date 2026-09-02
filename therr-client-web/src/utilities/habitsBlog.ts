/**
 * Cross-posted blog for habits.therr.com.
 *
 * `../data/habitsBlogPosts.json` is GENERATED — do not hand-edit it. It is produced
 * by `npm run export:habits-blog` in the sibling therr-landing repo from posts there
 * that carry a `habits` block, and committed here because the two repos share no CI
 * and habits.therr.com is served out of this one.
 *
 * That export script is also where the "this must be an adaptation, not a copy" check
 * lives. Both the therr.app original and the habits version are self-canonical, so a
 * near-duplicate would put the two pages in competition — and the therr.app copies are
 * currently the only organic channel that grows on its own, so losing that trade would
 * be strictly worse than not cross-posting at all.
 *
 * This exists because habits.therr.com shipped with a three-URL sitemap and no content,
 * while the habit-and-accountability posts that actually rank sat on another domain.
 */

import habitsBlogPosts from '../data/habitsBlogPosts.json';

export interface IHabitsBlogPost {
    slug: string;
    title: string;
    description: string;
    excerpt: string;
    keywords: string;
    /** Semantic article HTML, authored in this repo's data file — never user input. */
    bodyHtml: string;
    date: string;
    dateDisplay: string;
    author: string;
    canonicalUrl: string;
    /** The therr.app original. A visible "longer version" link, never a rel=canonical. */
    relatedLandingUrl: string;
}

export const HABITS_BLOG_POSTS = habitsBlogPosts as IHabitsBlogPost[];

const POSTS_BY_SLUG = new Map(HABITS_BLOG_POSTS.map((post) => [post.slug, post]));

export const HABITS_BLOG_LIST_TITLE = 'Notes on Habits and Accountability — Friends with Habits';
export const HABITS_BLOG_LIST_DESCRIPTION = 'Why habits stick when someone else is on the hook: notes on '
    + 'accountability partners, shared streaks, and what the research on friendship and follow-through actually says.';

/**
 * Trailing slash tolerated so a shared link carrying one does not 404. The slug shape
 * is enforced at export time; matching here is only a cheap pre-filter before the map
 * lookup, so an unknown path can produce a 404 and nothing else.
 */
const BLOG_POST_PATH_RE = /^\/blog\/([a-z0-9-]{1,120})\/?$/;

export const isHabitsBlogListPath = (pathname: string): boolean => pathname === '/blog' || pathname === '/blog/';

/** The post for a `/blog/:slug` path, or null for the index, an unknown slug, or any other path. */
export const matchHabitsBlogPost = (pathname: string): IHabitsBlogPost | null => {
    const match = pathname.match(BLOG_POST_PATH_RE);
    if (!match) return null;

    return POSTS_BY_SLUG.get(match[1]) || null;
};

/**
 * Article JSON-LD for a cross-post.
 *
 * `JSON.stringify` escapes what a script body needs escaped, which is why the view
 * renders this through a Handlebars triple-stash. Handing the raw object to Handlebars
 * instead would HTML-escape every apostrophe to `&#x27;` — an entity JSON-LD parsers do
 * not decode, silently invalidating the whole block. The habits landing page carries a
 * comment about the same trap.
 */
export const buildHabitsBlogJsonLd = (post: IHabitsBlogPost): string => JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    keywords: post.keywords,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: 'en-US',
    author: { '@type': 'Person', name: post.author },
    publisher: {
        '@type': 'Organization',
        name: 'Therr Inc.',
        url: 'https://habits.therr.com/',
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': post.canonicalUrl },
    url: post.canonicalUrl,
    image: 'https://habits.therr.com/assets/images/habits-og-image.png',
    about: {
        '@type': 'SoftwareApplication',
        name: 'Friends with Habits',
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Android',
        url: 'https://habits.therr.com/',
    },
});
