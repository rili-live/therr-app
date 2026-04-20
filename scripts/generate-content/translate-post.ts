#!/usr/bin/env node
/**
 * Emit a translator-ready prompt (and source JSON) for a guide post.
 *
 * Reads an existing guide from `therr-client-web/src/content/guides/<slug>.json`
 * and prints a prompt to stdout that an editor can paste into a translator —
 * a native speaker, DeepL, ChatGPT/Claude, etc. The expected output is the
 * `locales.<locale>` block (JSON), which the editor then folds into the post
 * and saves via `save-post --require-locales <locale>`.
 *
 * Usage:
 *   npx ts-node scripts/generate-content/translate-post \
 *     --slug editors-picks-bars-chicago --locale es
 *
 *   # Emit only the source payload (no instructions) for a headless translator:
 *   npx ts-node scripts/generate-content/translate-post \
 *     --slug editors-picks-bars-chicago --locale fr-ca --format source-json
 *
 * Flags:
 *   --slug <slug>       Required. Guide slug to translate.
 *   --locale <code>     Required. Target locale: `es` or `fr-ca`.
 *   --format <kind>     `prompt` (default) | `source-json` | `skeleton`.
 *                       - prompt:      full translator prompt + source JSON
 *                       - source-json: only the source payload (no instructions)
 *                       - skeleton:    an empty locale block shaped like the
 *                                      expected output, for hand-translation
 *
 * Output goes to stdout; progress to stderr.
 *
 * LLM-assisted mode is intentionally NOT implemented here — the plan
 * (docs/CONTENT_LOCALE_FIRST_PLAN.md Phase 3) recommends native-write for the
 * first 5 posts to calibrate, then re-evaluating LLM assistance with a
 * fluent-speaker reviewer gate.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    IPost, IPostSection, PostLocale,
} from './utils/contentSchema';

const GUIDES_DIR = path.resolve(__dirname, '../../therr-client-web/src/content/guides');
const VALID_LOCALES: PostLocale[] = ['es', 'fr-ca'];
const VALID_FORMATS = ['prompt', 'source-json', 'skeleton'] as const;
type OutputFormat = typeof VALID_FORMATS[number];

const LOCALE_LABEL: Record<PostLocale, string> = {
    es: 'Latin-American Spanish (es-MX)',
    'fr-ca': 'Quebec / Canadian French (fr-CA)',
};

function log(msg: string) { process.stderr.write(`${msg}\n`); }

interface ICliArgs {
    slug: string;
    locale: PostLocale;
    format: OutputFormat;
}

function parseArgs(): ICliArgs {
    const args = process.argv.slice(2);
    let slug = '';
    let locale: PostLocale | '' = '';
    let format: OutputFormat = 'prompt';
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--slug' && i + 1 < args.length) {
            slug = args[i + 1]; i++;
        } else if (a === '--locale' && i + 1 < args.length) {
            const v = args[i + 1];
            if (!VALID_LOCALES.includes(v as PostLocale)) {
                log(`Unknown locale "${v}"; valid: ${VALID_LOCALES.join(', ')}.`);
                process.exit(1);
            }
            locale = v as PostLocale;
            i++;
        } else if (a === '--format' && i + 1 < args.length) {
            const v = args[i + 1];
            if (!VALID_FORMATS.includes(v as OutputFormat)) {
                log(`Unknown format "${v}"; valid: ${VALID_FORMATS.join(', ')}.`);
                process.exit(1);
            }
            format = v as OutputFormat;
            i++;
        }
    }
    if (!slug) { log('Missing --slug.'); process.exit(1); }
    if (!locale) { log('Missing --locale.'); process.exit(1); }
    return { slug, locale, format };
}

function loadPost(slug: string): IPost {
    const filename = path.join(GUIDES_DIR, `${slug}.json`);
    if (!fs.existsSync(filename)) {
        log(`Post not found: ${filename}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(filename, 'utf8')) as IPost;
}

function translatableSections(sections: IPostSection[]): IPostSection[] {
    // Return a copy with only the fields that a translator should touch.
    // `spaceId`, `rank`, numeric rows, and hrefs stay as-is so the translator
    // doesn't accidentally rewrite identifiers or destination URLs.
    return sections.map((s) => {
        switch (s.type) {
            case 'prose':
                return { type: 'prose', body: s.body };
            case 'space-list':
                return {
                    type: 'space-list',
                    items: s.items.map((i) => ({
                        spaceId: i.spaceId,
                        rank: i.rank,
                        blurb: i.blurb,
                        ...(i.reason ? { reason: i.reason } : {}),
                    })),
                };
            case 'data-callout':
                return {
                    type: 'data-callout',
                    stat: s.stat,
                    statLabel: s.statLabel,
                    ...(s.body ? { body: s.body } : {}),
                };
            case 'data-table':
                return {
                    type: 'data-table',
                    caption: s.caption,
                    headers: s.headers,
                    rows: s.rows,
                };
            case 'faq':
                return { type: 'faq', items: s.items };
            case 'cta':
                return {
                    type: 'cta',
                    heading: s.heading,
                    body: s.body,
                    ...(s.href ? { href: s.href } : {}),
                    ...(s.ctaText ? { ctaText: s.ctaText } : {}),
                };
            default:
                return s;
        }
    });
}

function buildSkeleton(post: IPost): Record<string, unknown> {
    // Parallel structure to the source sections (same types in same order),
    // but string fields blank. Translator fills them in; numeric / id fields
    // are copied through so the block remains valid.
    const sections = post.sections.map((s) => {
        switch (s.type) {
            case 'prose':
                return { type: 'prose', body: '' };
            case 'space-list':
                return {
                    type: 'space-list',
                    items: s.items.map((i) => ({
                        spaceId: i.spaceId,
                        rank: i.rank,
                        blurb: '',
                        ...(i.reason !== undefined ? { reason: '' } : {}),
                    })),
                };
            case 'data-callout':
                return {
                    type: 'data-callout',
                    stat: s.stat,
                    statLabel: '',
                    ...(s.body !== undefined ? { body: '' } : {}),
                };
            case 'data-table':
                return {
                    type: 'data-table',
                    caption: '',
                    headers: s.headers.map(() => ''),
                    rows: s.rows,
                };
            case 'faq':
                return { type: 'faq', items: s.items.map(() => ({ question: '', answer: '' })) };
            case 'cta':
                return {
                    type: 'cta',
                    heading: '',
                    body: '',
                    ...(s.href ? { href: s.href } : {}),
                    ...(s.ctaText !== undefined ? { ctaText: '' } : {}),
                };
            default:
                return s;
        }
    });
    return {
        title: '',
        description: '',
        lead: '',
        sections,
    };
}

function buildPrompt(post: IPost, locale: PostLocale): string {
    const label = LOCALE_LABEL[locale];
    const source = {
        title: post.title,
        description: post.description,
        lead: post.lead,
        sections: translatableSections(post.sections),
    };
    return [
        `You are translating an editorial travel / local-business guide into ${label}.`,
        '',
        'Rules:',
        `- Output a single JSON object matching the shape of "locales.${locale}" `
            + '(see the schema at the bottom). No prose around the JSON.',
        '- Preserve every `type`, `spaceId`, `rank`, `href`, numeric row value, and array length exactly. Translate only user-visible strings.',
        '- Keep `title` ≤ 70 characters and `description` ≤ 165 characters (both are SEO meta limits).',
        '- Keep the tone natural for a local reader of the target locale — do NOT translate brand / venue names '
            + 'unless that brand is officially localized. Keep business names as-is.',
        '- Do NOT change the order of sections. The array order is the reading order.',
        '- For `fr-ca` specifically: use Quebec French conventions (e.g., "fin de semaine", not "week-end"), but avoid regional slang that won\'t travel.',
        '- For `es`: use neutral Latin-American Spanish (es-MX register). Avoid peninsular forms ("vosotros", "coger", etc.).',
        '',
        'Expected JSON schema for the returned block:',
        '```json',
        '{',
        '  "title": "<translated>",',
        '  "description": "<translated>",',
        '  "lead": "<translated>",',
        '  "sections": [ /* same length, same types, same order as source.sections */ ]',
        '}',
        '```',
        '',
        'Source (English):',
        '```json',
        JSON.stringify(source, null, 2),
        '```',
        '',
        `Return ONLY the translated JSON block for locales.${locale}.`,
    ].join('\n');
}

function main(): void {
    const args = parseArgs();
    const post = loadPost(args.slug);

    if (args.format === 'source-json') {
        const payload = {
            slug: post.slug,
            targetLocale: args.locale,
            source: {
                title: post.title,
                description: post.description,
                lead: post.lead,
                sections: translatableSections(post.sections),
            },
        };
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
    }

    if (args.format === 'skeleton') {
        process.stdout.write(`${JSON.stringify(buildSkeleton(post), null, 2)}\n`);
        return;
    }

    process.stdout.write(`${buildPrompt(post, args.locale)}\n`);
}

main();
