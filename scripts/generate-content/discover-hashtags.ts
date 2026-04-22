#!/usr/bin/env node
/**
 * Discover (city, hashtag) pairs with enough spaces to anchor a guide.
 *
 * Splits the comma-separated `spaces.hashTags` text field into individual tags
 * and counts per-(city, tag) occurrences. Tags are lowercased + trimmed; an
 * exact normalized match is used (we do NOT substring-match `firstdate`
 * against `firstdateandlast`).
 *
 * Context caveat — READ BEFORE USING:
 * The `spaces.hashTags` column is currently populated mostly by the OSM
 * ingester (`scripts/import-spaces/transforms/mapToSpace.ts` → `buildHashTags`),
 * which derives tags from `cuisine` / `amenity` / `shop` / `tourism` OSM tags.
 * Those are closer to categories than to user-applied intent. Until a meaningful
 * chunk of user-applied tags lands (e.g., `firstdate`, `latenight`,
 * `worksession`), this discovery tool will mostly surface cuisine words.
 * Use the output to decide whether the hashtag-anchored plan actually has
 * signal before investing in Phases 2–5. See docs/CONTENT_HASHTAG_GUIDES_PLAN.md.
 *
 * Usage:
 *   npx ts-node scripts/generate-content/discover-hashtags \
 *     [--city <name>] [--minSpaces <n>] [--limit <n>] [--intentOnly]
 *
 * Flags:
 *   --city <name>       Filter to a single city (ILIKE match).
 *   --minSpaces <n>     Minimum space count per (city, tag). Default 8.
 *   --limit <n>         Max rows in output. Default 100.
 *   --intentOnly        Filter to an allowlist of intent-shaped tags
 *                       (firstdate, latenight, worksession, livemusic,
 *                       outdoorseating, dogfriendly, kidfriendly,
 *                       groupfriendly, roomforevent, happyhour, brunch).
 *
 * Stdout: JSON array of rows { city, region, hashtag, spaceCount,
 *   distinctCategories, sampleCategories[] }.
 * Stderr: progress.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createDbPool } from '../import-spaces/utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../import-spaces/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Hashtags that describe *what you're trying to do tonight* rather than a cuisine
 * or amenity type. If the discover output is dominated by cuisine words
 * (`italian`, `pizza`, `bar`), passing `--intentOnly` filters to this list.
 * Expand as the `hashTags` data grows richer.
 */
const INTENT_HASHTAG_ALLOWLIST = [
    'firstdate',
    'datenight',
    'latenight',
    'worksession',
    'workfriendly',
    'livemusic',
    'outdoorseating',
    'patio',
    'rooftop',
    'dogfriendly',
    'kidfriendly',
    'familyfriendly',
    'groupfriendly',
    'roomforevent',
    'privateevents',
    'happyhour',
    'brunch',
    'solo',
    'quiet',
    'romantic',
    'cozy',
];

function log(msg: string) {
    process.stderr.write(`${msg}\n`);
}

interface ICliArgs {
    city: string;
    minSpaces: number;
    limit: number;
    intentOnly: boolean;
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
    return {
        city: parsed.city || '',
        minSpaces: parsed.minSpaces ? parseInt(parsed.minSpaces, 10) : 8,
        limit: parsed.limit ? parseInt(parsed.limit, 10) : 100,
        intentOnly: flags.has('intentOnly'),
    };
}

async function main() {
    const args = parseArgs();
    log(`Discovering (city, hashtag) pairs: minSpaces=${args.minSpaces} limit=${args.limit}`
        + `${args.city ? ` city=${args.city}` : ''}${args.intentOnly ? ' intentOnly' : ''}`);

    const db = createDbPool({ max: 3 });
    try {
        const params: (string | number | string[])[] = [args.minSpaces];
        const filters: string[] = [];
        if (args.city) {
            params.push(`%${args.city}%`);
            filters.push(`AND s."addressLocality" ILIKE $${params.length}`);
        }
        if (args.intentOnly) {
            params.push(INTENT_HASHTAG_ALLOWLIST);
            filters.push(`AND LOWER(TRIM(tag)) = ANY($${params.length}::text[])`);
        }

        const sql = `
            SELECT
                s."addressLocality" AS city,
                s."addressRegion" AS region,
                LOWER(TRIM(tag)) AS hashtag,
                COUNT(DISTINCT s.id)::int AS "spaceCount",
                COUNT(DISTINCT s.category)::int AS "distinctCategories",
                (ARRAY_AGG(DISTINCT s.category ORDER BY s.category))[1:5] AS "sampleCategories"
            FROM main.spaces s,
                LATERAL unnest(string_to_array(s."hashTags", ',')) AS tag
            WHERE s."isPublic" = true
              AND s."addressLocality" IS NOT NULL
              AND s."hashTags" IS NOT NULL
              AND s."hashTags" <> ''
              AND LENGTH(TRIM(tag)) > 0
              ${filters.join('\n              ')}
            GROUP BY s."addressLocality", s."addressRegion", LOWER(TRIM(tag))
            HAVING COUNT(DISTINCT s.id) >= $1
            ORDER BY "spaceCount" DESC, city ASC, hashtag ASC
            LIMIT ${Math.max(1, Math.min(500, args.limit))}
        `;

        const result = await db.query(sql, params);
        log(`Found ${result.rows.length} (city, hashtag) buckets meeting threshold.`);
        console.log(JSON.stringify(result.rows, null, 2));
    } finally {
        await db.end();
    }
}

main().catch((err) => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
});
