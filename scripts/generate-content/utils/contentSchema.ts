/**
 * Content schema for editorial guide posts (`/guides/:slug`).
 *
 * Posts are stored as static JSON files in
 * `therr-client-web/src/content/guides/<slug>.json` and rendered server-side
 * for SEO. Two primary types:
 *
 *   - `list`  : Curated rankings of spaces (e.g., "Best Live Music Bars in Cincinnati")
 *   - `data`  : Aggregations of Therr activity (e.g., "Where Cincinnati hangs out on Fridays")
 *
 * `mixed` posts combine both. Locale variants (`es`, `fr-ca`) are optional;
 * EN is always required.
 */

export type PostType = 'list' | 'data' | 'mixed';
export type PostStatus = 'draft' | 'published';
export type PostLocale = 'es' | 'fr-ca';

export interface IPostHeroImage {
    url: string;
    alt: string;
    credit?: string;
}

export interface IPostMetadata {
    slug: string;
    type: PostType;
    status: PostStatus;
    /** Default-locale (en-us) page title — used in <title> and as H1. */
    title: string;
    /** Default-locale meta description (≤160 chars recommended). */
    description: string;
    /** City slug (matches CITIES key from scripts/import-spaces/config.ts). */
    city?: string;
    /** Category slug (matches space.category). */
    category?: string;
    // TODO: add `hashtag?: string` for hashtag-anchored posts.
    // See docs/CONTENT_HASHTAG_GUIDES_PLAN.md (Phase 3). Validator must enforce
    // that exactly one of {category, hashtag} is set.
    /** ISO date string (yyyy-mm-dd). */
    publishedAt: string;
    /** ISO date string (yyyy-mm-dd). */
    updatedAt: string;
    /** Author byline (E-E-A-T signal). */
    author: string;
    /** Optional author bio/profile URL. */
    authorUrl?: string;
    /** Optional hero image displayed at top of post. */
    heroImage?: IPostHeroImage;
}

export interface IProseSection {
    type: 'prose';
    body: string;
}

export interface ISpaceListItem {
    spaceId: string;
    rank: number;
    /** Editorial blurb (1–3 sentences) describing why this space made the list. */
    blurb: string;
    /** Optional one-line tag (e.g., "Best for first dates"). */
    reason?: string;
}

export interface ISpaceListSection {
    type: 'space-list';
    items: ISpaceListItem[];
}

export interface IDataCalloutSection {
    type: 'data-callout';
    /** The stat itself (e.g., "73%"). Rendered large. */
    stat: string;
    /** Short label below the stat (e.g., "of weekend check-ins happen after 9pm"). */
    statLabel: string;
    /** Optional supporting paragraph. */
    body?: string;
}

export interface IDataTableSection {
    type: 'data-table';
    caption: string;
    headers: string[];
    rows: (string | number)[][];
}

export interface IFAQItem {
    question: string;
    answer: string;
}

export interface IFAQSection {
    type: 'faq';
    items: IFAQItem[];
}

export interface ICTASection {
    type: 'cta';
    heading: string;
    body: string;
    href?: string;
    ctaText?: string;
}

// TODO: planned new section types — see docs/CONTENT_GUIDES_ROADMAP.md
//   - 'walkable-route'  → docs/CONTENT_WALKABLE_CLUSTERS_PLAN.md (Phase 4)
//   - 'moment-quote'    → docs/CONTENT_MOMENT_DRIVEN_PLAN.md (Phase 4)
// Adding a new section type also requires updating validatePost below and
// mirroring the type into therr-client-web/src/utilities/guideContent.ts.
export type IPostSection =
    | IProseSection
    | ISpaceListSection
    | IDataCalloutSection
    | IDataTableSection
    | IFAQSection
    | ICTASection;

export interface IPostLocaleContent {
    title: string;
    description: string;
    lead: string;
    sections: IPostSection[];
}

export interface IPost extends IPostMetadata {
    /** Default-locale (en-us) intro paragraph. */
    lead: string;
    /** Default-locale (en-us) body sections, in order. */
    sections: IPostSection[];
    /** Optional translated content per locale. */
    locales?: Partial<Record<PostLocale, IPostLocaleContent>>;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES: PostType[] = ['list', 'data', 'mixed'];
const VALID_STATUSES: PostStatus[] = ['draft', 'published'];

export interface IValidationError {
    field: string;
    message: string;
}

/**
 * Lightweight runtime validation. Returns an array of errors; empty array means valid.
 * Not a replacement for static types — guards against malformed input from the LLM.
 */
export function validatePost(input: unknown): IValidationError[] {
    const errors: IValidationError[] = [];
    if (!input || typeof input !== 'object') {
        return [{ field: '<root>', message: 'Post must be an object.' }];
    }
    const p = input as Record<string, unknown>;

    if (typeof p.slug !== 'string' || !SLUG_RE.test(p.slug)) {
        errors.push({ field: 'slug', message: 'Required, lowercase-kebab-case (e.g., "best-coffee-portland").' });
    }
    if (typeof p.type !== 'string' || !VALID_TYPES.includes(p.type as PostType)) {
        errors.push({ field: 'type', message: `Must be one of: ${VALID_TYPES.join(', ')}.` });
    }
    if (typeof p.status !== 'string' || !VALID_STATUSES.includes(p.status as PostStatus)) {
        errors.push({ field: 'status', message: `Must be one of: ${VALID_STATUSES.join(', ')}.` });
    }
    if (typeof p.title !== 'string' || !p.title.trim()) {
        errors.push({ field: 'title', message: 'Required, non-empty.' });
    } else if (p.title.length > 70) {
        errors.push({ field: 'title', message: 'Should be ≤70 chars for SEO (got ' + p.title.length + ').' });
    }
    if (typeof p.description !== 'string' || !p.description.trim()) {
        errors.push({ field: 'description', message: 'Required, non-empty.' });
    } else if (p.description.length > 165) {
        errors.push({ field: 'description', message: 'Should be ≤165 chars for SEO (got ' + p.description.length + ').' });
    }
    if (typeof p.publishedAt !== 'string' || !ISO_DATE_RE.test(p.publishedAt)) {
        errors.push({ field: 'publishedAt', message: 'Required, ISO date (yyyy-mm-dd).' });
    }
    if (typeof p.updatedAt !== 'string' || !ISO_DATE_RE.test(p.updatedAt)) {
        errors.push({ field: 'updatedAt', message: 'Required, ISO date (yyyy-mm-dd).' });
    }
    if (typeof p.author !== 'string' || !p.author.trim()) {
        errors.push({ field: 'author', message: 'Required, non-empty (E-E-A-T signal).' });
    }
    if (typeof p.lead !== 'string' || !p.lead.trim()) {
        errors.push({ field: 'lead', message: 'Required, non-empty (intro paragraph).' });
    }
    if (!Array.isArray(p.sections) || p.sections.length === 0) {
        errors.push({ field: 'sections', message: 'Required, at least one section.' });
    } else {
        p.sections.forEach((s, i) => {
            if (!s || typeof s !== 'object' || typeof (s as any).type !== 'string') {
                errors.push({ field: `sections[${i}]`, message: 'Section must have a type field.' });
            }
        });
    }
    return errors;
}
