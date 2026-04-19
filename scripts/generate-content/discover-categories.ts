#!/usr/bin/env node
/**
 * Discover what (city, category) pairs have spaces with non-zero visit counts
 * over a given window. Prints a ranked summary to stdout for picking pilot
 * post targets.
 *
 * Usage:
 *   npx ts-node scripts/generate-content/discover-categories \
 *     [--city <name>] [--window <days>] [--minSpaces <n>]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createDbPool } from '../import-spaces/utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../import-spaces/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function log(msg: string) {
    process.stderr.write(`${msg}\n`);
}

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--') && i + 1 < args.length) {
            parsed[args[i].replace('--', '')] = args[i + 1];
            i++;
        }
    }
    return {
        city: parsed.city || '',
        windowDays: parsed.window ? parseInt(parsed.window, 10) : 180,
        minSpaces: parsed.minSpaces ? parseInt(parsed.minSpaces, 10) : 5,
    };
}

async function main() {
    const args = parseArgs();
    log(`Discovering (city,category) pairs: window=${args.windowDays}d minSpaces=${args.minSpaces}${args.city ? ` city=${args.city}` : ''}`);

    const db = createDbPool({ max: 3 });
    try {
        const cityFilter = args.city ? 'AND s."addressLocality" ILIKE $2' : '';
        const params: any[] = [args.windowDays.toString()];
        if (args.city) params.push(`%${args.city}%`);

        const sql = `
            SELECT
                s."addressLocality" AS city,
                s."addressRegion" AS region,
                s.category,
                COUNT(DISTINCT s.id) AS space_count,
                COALESCE(SUM(m.visits), 0)::int AS total_visits
            FROM main.spaces s
            LEFT JOIN (
                SELECT "spaceId", COUNT(*) AS visits
                FROM main."spaceMetrics"
                WHERE name = 'space.user.visit'
                  AND "createdAt" >= NOW() - ($1 || ' days')::interval
                GROUP BY "spaceId"
            ) m ON m."spaceId" = s.id
            WHERE s."isPublic" = true
              AND s."addressLocality" IS NOT NULL
              AND s.category IS NOT NULL
              ${cityFilter}
            GROUP BY s."addressLocality", s."addressRegion", s.category
            HAVING COUNT(DISTINCT s.id) >= ${args.minSpaces}
            ORDER BY total_visits DESC, space_count DESC
            LIMIT 60
        `;
        const result = await db.query(sql, params);
        log(`Found ${result.rows.length} (city, category) buckets.`);
        console.log(JSON.stringify(result.rows, null, 2));
    } finally {
        await db.end();
    }
}

main().catch((err) => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
});
