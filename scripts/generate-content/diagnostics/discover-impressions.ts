#!/usr/bin/env node
/** Find (city, category) buckets with enough impression volume to power a post. */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createDbPool } from '../../import-spaces/utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../import-spaces/.env') });

async function main() {
    const db = createDbPool({ max: 2 });
    const directJoin = await db.query(`
        SELECT sm."spaceId" AS sm_space_id, s.id AS s_id, s."notificationMsg", s."addressLocality"
        FROM main."spaceMetrics" sm
        LEFT JOIN main.spaces s ON s.id = sm."spaceId"
        WHERE sm.name = 'space.user.impression'
        LIMIT 5
    `);
    console.log(JSON.stringify({ directJoinSample: directJoin.rows }, null, 2));

    const sample = await db.query(`
        SELECT sm."spaceId", sm.name, sm."valueType", sm.value
        FROM main."spaceMetrics" sm
        WHERE sm.name = 'space.user.impression'
        LIMIT 3
    `);
    console.log(JSON.stringify({ sampleImpressions: sample.rows }, null, 2));
    if (sample.rows.length) {
        const sid = sample.rows[0].spaceId;
        const lookup = await db.query(`
            SELECT id, "notificationMsg", "addressLocality", "isPublic" FROM main.spaces WHERE id = $1
        `, [sid]);
        const lookupAreas = await db.query(`
            SELECT id, "notificationMsg" FROM main.areas WHERE id = $1
        `, [sid]).catch(() => ({ rows: [] }));
        console.log(JSON.stringify({ spaceLookup: lookup.rows, areaLookup: lookupAreas.rows }, null, 2));
    }

    const join = await db.query(`
        SELECT COUNT(*)::int AS impressions_with_space,
               COUNT(*) FILTER (WHERE s.id IS NULL)::int AS impressions_orphaned,
               COUNT(*) FILTER (WHERE s."addressLocality" IS NOT NULL)::int AS with_locality,
               COUNT(*) FILTER (WHERE s."isPublic" = true)::int AS public_spaces
        FROM main."spaceMetrics" sm
        LEFT JOIN main.spaces s ON s.id = sm."spaceId"
        WHERE sm.name = 'space.user.impression'
          AND sm."createdAt" >= NOW() - INTERVAL '90 days'
    `);
    console.log(JSON.stringify({ joinDiagnostic: join.rows[0] }, null, 2));

    const byCity = await db.query(`
        SELECT s."addressLocality" AS city, s."addressRegion" AS region,
               COUNT(*)::int AS impressions,
               COUNT(DISTINCT s.id)::int AS spaces
        FROM main."spaceMetrics" sm
        JOIN main.spaces s ON s.id = sm."spaceId"
        WHERE sm.name = 'space.user.impression'
        GROUP BY s."addressLocality", s."addressRegion"
        ORDER BY impressions DESC
        LIMIT 25
    `);
    const byCityCat = await db.query(`
        SELECT s."addressLocality" AS city, s.category,
               COUNT(*)::int AS impressions,
               COUNT(DISTINCT s.id)::int AS spaces
        FROM main."spaceMetrics" sm
        JOIN main.spaces s ON s.id = sm."spaceId"
        WHERE sm.name = 'space.user.impression'
          AND sm."createdAt" >= NOW() - INTERVAL '90 days'
          AND s."addressLocality" IS NOT NULL
          AND s.category IS NOT NULL
        GROUP BY s."addressLocality", s.category
        HAVING COUNT(*) >= 100
        ORDER BY impressions DESC
        LIMIT 25
    `);
    console.log(JSON.stringify({ byCity: byCity.rows, byCityCategory: byCityCat.rows }, null, 2));
    await db.end();
}
main().catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
