#!/usr/bin/env node
/**
 * Validate and save a guide post JSON file.
 *
 * Reads a draft JSON from --content <path> (or stdin if --stdin), validates
 * against the IPost schema, writes to
 * `therr-client-web/src/content/guides/<slug>.json`, and regenerates the
 * `index.json` manifest used by the Guides index page.
 *
 * Usage:
 *   npx ts-node scripts/generate-content/save-post --content /tmp/draft.json
 *   cat draft.json | npx ts-node scripts/generate-content/save-post --stdin
 *
 * Flags:
 *   --force                      Overwrite an existing post with the same slug.
 *   --dry-run                    Validate and report; do not write files.
 *   --require-locales <es,fr-ca> Fail validation unless those locale blocks
 *                                are present and well-formed. Use to gate
 *                                multilingual publishing.
 *
 * Stdout: JSON result `{ ok, written, slug, indexCount }`. Stderr: progress.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    IPost, IPostMetadata, PostLocale, validatePost,
} from './utils/contentSchema';

const VALID_LOCALES: PostLocale[] = ['es', 'fr-ca'];

const GUIDES_DIR = path.resolve(__dirname, '../../therr-client-web/src/content/guides');
const INDEX_FILE = path.join(GUIDES_DIR, 'index.json');

function log(msg: string) { process.stderr.write(`${msg}\n`); }

interface ICliArgs {
    contentPath?: string;
    fromStdin: boolean;
    force: boolean;
    dryRun: boolean;
    requireLocales: PostLocale[];
}

function parseLocaleList(raw: string): PostLocale[] {
    return raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
        if (!VALID_LOCALES.includes(s as PostLocale)) {
            log(`Unknown locale "${s}" in --require-locales; valid: ${VALID_LOCALES.join(', ')}.`);
            process.exit(1);
        }
        return s as PostLocale;
    });
}

function parseArgs(): ICliArgs {
    const args = process.argv.slice(2);
    const out: ICliArgs = {
        fromStdin: false, force: false, dryRun: false, requireLocales: [],
    };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--stdin') out.fromStdin = true;
        else if (a === '--force') out.force = true;
        else if (a === '--dry-run') out.dryRun = true;
        else if (a === '--content' && i + 1 < args.length) {
            out.contentPath = args[i + 1];
            i++;
        } else if (a === '--require-locales' && i + 1 < args.length) {
            out.requireLocales = parseLocaleList(args[i + 1]);
            i++;
        }
    }
    if (!out.contentPath && !out.fromStdin) {
        log('Provide --content <path> or --stdin.');
        process.exit(1);
    }
    return out;
}

async function readInput(args: ICliArgs): Promise<string> {
    if (args.fromStdin) {
        return new Promise((resolve, reject) => {
            let buf = '';
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', (chunk: string) => { buf += chunk; });
            process.stdin.on('end', () => resolve(buf));
            process.stdin.on('error', reject);
        });
    }
    return fs.promises.readFile(args.contentPath!, 'utf8');
}

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

interface IIndexEntry {
    slug: string;
    type: IPostMetadata['type'];
    status: IPostMetadata['status'];
    title: string;
    description: string;
    city?: string;
    category?: string;
    publishedAt: string;
    updatedAt: string;
}

function rebuildIndex(): IIndexEntry[] {
    const entries: IIndexEntry[] = [];
    if (!fs.existsSync(GUIDES_DIR)) return entries;
    const files = fs.readdirSync(GUIDES_DIR)
        .filter((f) => f.endsWith('.json') && f !== 'index.json');
    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf8');
            const post = JSON.parse(raw) as IPost;
            entries.push({
                slug: post.slug,
                type: post.type,
                status: post.status,
                title: post.title,
                description: post.description,
                city: post.city,
                category: post.category,
                publishedAt: post.publishedAt,
                updatedAt: post.updatedAt,
            });
        } catch (err: any) {
            log(`WARN: Failed to index ${file}: ${err.message}`);
        }
    }
    // Newest first; drafts mixed in (consumer filters).
    entries.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    return entries;
}

async function main() {
    const args = parseArgs();
    const raw = await readInput(args);
    let post: IPost;
    try {
        post = JSON.parse(raw);
    } catch (err: any) {
        log(`Failed to parse JSON: ${err.message}`);
        process.exit(1);
    }

    const errors = validatePost(post, { requireLocales: args.requireLocales });
    if (errors.length > 0) {
        log('Validation failed:');
        for (const e of errors) log(`  - ${e.field}: ${e.message}`);
        process.exit(1);
    }

    ensureDir(GUIDES_DIR);
    const filename = path.join(GUIDES_DIR, `${post.slug}.json`);
    const exists = fs.existsSync(filename);

    if (exists && !args.force) {
        log(`Refusing to overwrite ${filename}. Pass --force to replace.`);
        process.exit(1);
    }

    if (args.dryRun) {
        log(`[dry-run] Would write ${filename} (${exists ? 'overwrite' : 'new'}).`);
        const indexPreview = rebuildIndex();
        console.log(JSON.stringify({
            ok: true, dryRun: true, slug: post.slug, written: false, indexCount: indexPreview.length,
        }, null, 2));
        return;
    }

    fs.writeFileSync(filename, `${JSON.stringify(post, null, 2)}\n`, 'utf8');
    const index = rebuildIndex();
    fs.writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

    log(`Wrote ${filename}`);
    log(`Index now contains ${index.length} post(s).`);
    console.log(JSON.stringify({
        ok: true, slug: post.slug, written: true, overwrite: exists, indexCount: index.length,
    }, null, 2));
}

main().catch((err) => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
});
