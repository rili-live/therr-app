#!/usr/bin/env node
/**
 * Refresh an existing guide post against current production data.
 *
 * Reads `therr-client-web/src/content/guides/<slug>.json`, gathers every
 * spaceId referenced in `space-list` sections, and re-queries each one to
 * detect drift since the post was written:
 *
 *   - "missing"   : space no longer exists
 *   - "private"   : space is no longer public (isPublic = false)
 *   - "renamed"   : notificationMsg differs from a hint we cached in the blurb
 *                  (informational only — we don't auto-rewrite blurbs)
 *   - "moved"     : addressLocality changed
 *   - "ok"        : space is still live and addressable
 *
 * Default mode is **report-only** (read-only). Pass `--apply` to write back:
 *   - Bump `updatedAt` to today
 *   - Prune `space-list` items whose spaceId is `missing` or `private`
 *   - Re-rank remaining items 1..N (preserving their relative order)
 *   - Optionally append top-N new candidates from a fresh query when
 *     `--add-new <n>` is passed (uses the post's city + category metadata)
 *
 * Usage:
 *   npx ts-node scripts/generate-content/refresh-post --slug best-bars-denver
 *   npx ts-node scripts/generate-content/refresh-post --slug best-bars-denver --apply
 *   npx ts-node scripts/generate-content/refresh-post --slug best-bars-denver --apply --add-new 3
 *
 * Stdout: JSON `{ slug, drift, additions, applied, updatedAt }`. Stderr: progress.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES } from '../import-spaces/config';
import { createDbPool } from '../import-spaces/utils/db';
import { IPost, ISpaceListItem, validatePost } from './utils/contentSchema';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../import-spaces/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GUIDES_DIR = path.resolve(__dirname, '../../therr-client-web/src/content/guides');
const INDEX_FILE = path.join(GUIDES_DIR, 'index.json');

function log(msg: string) { process.stderr.write(`${msg}\n`); }

interface ICliArgs {
    slug: string;
    apply: boolean;
    addNew: number;
    windowDays: number;
}

function parseArgs(): ICliArgs {
    const args = process.argv.slice(2);
    const parsed: Record<string, string> = {};
    const flags = new Set<string>();
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('--')) {
            const next = args[i + 1];
            if (!next || next.startsWith('--')) {
                flags.add(a.replace('--', ''));
            } else {
                parsed[a.replace('--', '')] = next;
                i++;
            }
        }
    }
    if (!parsed.slug) {
        log('Missing required --slug <post-slug>.');
        process.exit(1);
    }
    return {
        slug: parsed.slug,
        apply: flags.has('apply'),
        addNew: parsed['add-new'] ? parseInt(parsed['add-new'], 10) : 0,
        windowDays: parsed.window ? parseInt(parsed.window, 10) : 90,
    };
}

interface ISpaceLookup {
    id: string;
    name: string;
    isPublic: boolean;
    addressLocality: string | null;
    websiteUrl: string | null;
    category: string | null;
}

async function lookupSpaces(db: Pool, ids: string[]): Promise<Map<string, ISpaceLookup>> {
    if (ids.length === 0) return new Map();
    const sql = `
        SELECT s.id,
               s."notificationMsg" AS name,
               s."isPublic",
               s."addressLocality",
               s."websiteUrl",
               s.category
        FROM main.spaces s
        WHERE s.id = ANY($1::uuid[])
    `;
    const result = await db.query(sql, [ids]);
    const map = new Map<string, ISpaceLookup>();
    for (const row of result.rows) {
        map.set(row.id, {
            id: row.id,
            name: row.name,
            isPublic: row.isPublic,
            addressLocality: row.addressLocality,
            websiteUrl: row.websiteUrl,
            category: row.category,
        });
    }
    return map;
}

interface IDriftEntry {
    spaceId: string;
    rank: number;
    status: 'ok' | 'missing' | 'private' | 'moved';
    name?: string;
    note?: string;
}

function collectSpaceItems(post: IPost): { sectionIndex: number; items: ISpaceListItem[] }[] {
    const out: { sectionIndex: number; items: ISpaceListItem[] }[] = [];
    post.sections.forEach((s, i) => {
        if (s.type === 'space-list') out.push({ sectionIndex: i, items: s.items });
    });
    return out;
}

interface IFreshCandidate {
    id: string;
    name: string;
    completenessScore: number;
}

async function fetchFreshCandidates(db: Pool, post: IPost, excludeIds: Set<string>, n: number, windowDays: number): Promise<IFreshCandidate[]> {
    if (n <= 0 || !post.city || !post.category) return [];
    const cityConfig = CITIES[post.city];
    if (!cityConfig) {
        log(`Cannot pull fresh candidates: unknown city slug "${post.city}".`);
        return [];
    }
    const sql = `
        SELECT s.id,
               s."notificationMsg" AS name,
               (
                   (CASE WHEN s."websiteUrl" IS NOT NULL AND s."websiteUrl" != '' THEN 1 ELSE 0 END)
                 + (CASE WHEN s."phoneNumber" IS NOT NULL AND s."phoneNumber" != '' THEN 1 ELSE 0 END)
                 + (CASE WHEN s."addressStreetAddress" IS NOT NULL AND s."addressStreetAddress" != '' THEN 1 ELSE 0 END)
                 + (CASE WHEN s.message IS NOT NULL AND length(s.message) >= 60 THEN 1 ELSE 0 END)
                 + (CASE WHEN (s."mediaIds" IS NOT NULL AND s."mediaIds" != '')
                         OR (s.medias IS NOT NULL AND jsonb_array_length(s.medias) > 0) THEN 1 ELSE 0 END)
               ) AS completeness_score,
               COALESCE(v.visits, 0) AS visits,
               COALESCE(i.impressions, 0) AS impressions
        FROM main.spaces s
        LEFT JOIN (
            SELECT "spaceId", COUNT(*) AS visits FROM main."spaceMetrics"
            WHERE name = 'space.user.visit' AND "createdAt" >= NOW() - ($1 || ' days')::interval
            GROUP BY "spaceId"
        ) v ON v."spaceId" = s.id
        LEFT JOIN (
            SELECT "spaceId", COUNT(*) AS impressions FROM main."spaceMetrics"
            WHERE name = 'space.user.impression' AND "createdAt" >= NOW() - ($1 || ' days')::interval
            GROUP BY "spaceId"
        ) i ON i."spaceId" = s.id
        WHERE s."isPublic" = true
          AND s.category = $2
          AND s."addressLocality" ILIKE $3
        ORDER BY completeness_score DESC, (COALESCE(v.visits, 0) * 5 + COALESCE(i.impressions, 0)) DESC, s."createdAt" DESC
        LIMIT $4
    `;
    const fetchPool = Math.max(n * 4, 20);
    const result = await db.query(sql, [windowDays.toString(), post.category, `%${cityConfig.name}%`, fetchPool]);
    const fresh: IFreshCandidate[] = [];
    for (const row of result.rows) {
        if (!excludeIds.has(row.id)) {
            fresh.push({ id: row.id, name: row.name, completenessScore: Number(row.completeness_score) || 0 });
            if (fresh.length >= n) break;
        }
    }
    return fresh;
}

function rebuildIndexFromDir(): unknown[] {
    if (!fs.existsSync(GUIDES_DIR)) return [];
    return fs.readdirSync(GUIDES_DIR)
        .filter((f) => f.endsWith('.json') && f !== 'index.json')
        .map((file) => {
            const raw = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf8');
            const post = JSON.parse(raw) as IPost;
            return {
                slug: post.slug,
                type: post.type,
                status: post.status,
                title: post.title,
                description: post.description,
                city: post.city,
                category: post.category,
                publishedAt: post.publishedAt,
                updatedAt: post.updatedAt,
            };
        })
        .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
}

async function main() {
    const args = parseArgs();
    const filename = path.join(GUIDES_DIR, `${args.slug}.json`);
    if (!fs.existsSync(filename)) {
        log(`No post at ${filename}.`);
        process.exit(1);
    }
    const post = JSON.parse(fs.readFileSync(filename, 'utf8')) as IPost;

    const sectionsWithItems = collectSpaceItems(post);
    const allIds = Array.from(new Set(sectionsWithItems.flatMap((s) => s.items.map((i) => i.spaceId))));
    log(`Loaded "${args.slug}" — ${allIds.length} space references across ${sectionsWithItems.length} space-list section(s).`);

    const db = createDbPool({ max: 3 });
    try {
        await db.query('SELECT 1');
    } catch (err: any) {
        log(`Database connection failed: ${err.message}`);
        await db.end();
        process.exit(1);
    }

    const drift: IDriftEntry[] = [];
    let additions: IFreshCandidate[] = [];

    try {
        const lookup = await lookupSpaces(db, allIds);
        const classifyItem = (item: ISpaceListItem): IDriftEntry => {
            const live = lookup.get(item.spaceId);
            if (!live) return { spaceId: item.spaceId, rank: item.rank, status: 'missing' };
            if (!live.isPublic) {
                return {
                    spaceId: item.spaceId, rank: item.rank, status: 'private', name: live.name,
                };
            }
            if (post.city && live.addressLocality && CITIES[post.city]
                && !live.addressLocality.toLowerCase().includes(CITIES[post.city].name.toLowerCase())) {
                return {
                    spaceId: item.spaceId,
                    rank: item.rank,
                    status: 'moved',
                    name: live.name,
                    note: `addressLocality is now "${live.addressLocality}" (post city is ${CITIES[post.city].name})`,
                };
            }
            return {
                spaceId: item.spaceId, rank: item.rank, status: 'ok', name: live.name,
            };
        };
        for (const { items } of sectionsWithItems) {
            for (const item of items) {
                drift.push(classifyItem(item));
            }
        }

        if (args.addNew > 0) {
            const exclude = new Set(allIds);
            additions = await fetchFreshCandidates(db, post, exclude, args.addNew, args.windowDays);
        }
    } finally {
        await db.end();
    }

    const removable = new Set(drift.filter((d) => d.status === 'missing' || d.status === 'private').map((d) => d.spaceId));
    const today = new Date().toISOString().slice(0, 10);

    let applied = false;
    if (args.apply) {
        const lastSpaceListIdx = sectionsWithItems[sectionsWithItems.length - 1]?.sectionIndex;
        const updatedSections = post.sections.map((section, idx) => {
            if (section.type !== 'space-list') return section;
            const kept = section.items.filter((item) => !removable.has(item.spaceId));
            const reranked: ISpaceListItem[] = kept.map((item, i) => ({ ...item, rank: i + 1 }));
            if (additions.length > 0 && idx === lastSpaceListIdx) {
                additions.forEach((a) => {
                    reranked.push({
                        spaceId: a.id,
                        rank: reranked.length + 1,
                        blurb: '',
                        reason: 'Added during refresh — needs editorial blurb.',
                    });
                });
            }
            return { ...section, items: reranked };
        });

        const updatedPost: IPost = { ...post, updatedAt: today, sections: updatedSections };
        const errors = validatePost(updatedPost);
        if (errors.length > 0) {
            log('Refresh would produce an invalid post:');
            for (const e of errors) log(`  - ${e.field}: ${e.message}`);
            process.exit(1);
        }
        fs.writeFileSync(filename, `${JSON.stringify(updatedPost, null, 2)}\n`, 'utf8');
        const index = rebuildIndexFromDir();
        fs.writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
        applied = true;
        log(`Applied refresh: pruned ${removable.size}, added ${additions.length}, updatedAt=${today}.`);
        if (additions.length > 0) log(`NOTE: ${additions.length} new item(s) added with empty blurbs — fill them in editorially before next deploy.`);
    } else {
        log('Report only. Pass --apply to write changes.');
    }

    const summary = {
        slug: args.slug,
        applied,
        updatedAt: applied ? today : post.updatedAt,
        drift: {
            ok: drift.filter((d) => d.status === 'ok').length,
            missing: drift.filter((d) => d.status === 'missing').length,
            private: drift.filter((d) => d.status === 'private').length,
            moved: drift.filter((d) => d.status === 'moved').length,
            entries: drift,
        },
        additions: additions.map((a) => ({ spaceId: a.id, name: a.name, completenessScore: a.completenessScore })),
    };
    console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
});
