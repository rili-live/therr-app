#!/usr/bin/env node
/** Inspect what metric names exist in main.spaceMetrics and how recent they are. */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createDbPool } from '../import-spaces/utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../import-spaces/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const db = createDbPool({ max: 2 });
    try {
        const overall = await db.query(`
            SELECT name, COUNT(*)::int AS total, MAX("createdAt") AS most_recent
            FROM main."spaceMetrics"
            GROUP BY name
            ORDER BY total DESC
        `);
        console.log(JSON.stringify({ byMetricName: overall.rows }, null, 2));

        const last90 = await db.query(`
            SELECT name, COUNT(*)::int AS total
            FROM main."spaceMetrics"
            WHERE "createdAt" >= NOW() - INTERVAL '90 days'
            GROUP BY name
            ORDER BY total DESC
        `);
        console.log(JSON.stringify({ last90Days: last90.rows }, null, 2));

        const cats = await db.query(`
            SELECT category, COUNT(*)::int AS spaces
            FROM main.spaces
            WHERE "isPublic" = true AND category IS NOT NULL
            GROUP BY category
            ORDER BY spaces DESC
            LIMIT 30
        `);
        console.log(JSON.stringify({ topCategories: cats.rows }, null, 2));
    } finally {
        await db.end();
    }
}

main().catch((err) => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
});
