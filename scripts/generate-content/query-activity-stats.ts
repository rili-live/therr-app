#!/usr/bin/env node
/**
 * Aggregate Therr activity for data-driven posts.
 *
 * Topics:
 *   hour-of-day      Visit counts bucketed by local hour (0-23)
 *   day-of-week      Visit counts bucketed by ISO day-of-week (1=Mon..7=Sun)
 *   top-by-hour      Top N spaces for a specific hour bucket (e.g., 21 = 9pm)
 *   category-mix     Visit-share by category (bar, restaurant, cafe, ...)
 *
 * Usage:
 *   npx ts-node scripts/generate-content/query-activity-stats \
 *     --city austin --topic hour-of-day --window 90
 *   npx ts-node scripts/generate-content/query-activity-stats \
 *     --city austin --topic top-by-hour --hour 21 --window 90 --limit 10
 *
 * Stdout: JSON aggregation. Stderr: progress.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES } from '../import-spaces/config';
import { createDbPool } from '../import-spaces/utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../import-spaces/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type Topic = 'hour-of-day' | 'day-of-week' | 'top-by-hour' | 'category-mix';
const VALID_TOPICS: Topic[] = ['hour-of-day', 'day-of-week', 'top-by-hour', 'category-mix'];

interface ICliArgs {
    city: string;
    topic: Topic;
    windowDays: number;
    hour?: number;
    limit: number;
}

function log(msg: string) {
    process.stderr.write(`${msg}\n`);
}

function parseArgs(): ICliArgs {
    const args = process.argv.slice(2);
    const parsed: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--') && i + 1 < args.length) {
            parsed[args[i].replace('--', '')] = args[i + 1];
            i++;
        }
    }
    if (!parsed.city) {
        log('Missing --city <slug>.');
        process.exit(1);
    }
    if (!parsed.topic || !VALID_TOPICS.includes(parsed.topic as Topic)) {
        log(`Missing or invalid --topic. Must be one of: ${VALID_TOPICS.join(', ')}.`);
        process.exit(1);
    }
    const out: ICliArgs = {
        city: parsed.city,
        topic: parsed.topic as Topic,
        windowDays: parsed.window ? parseInt(parsed.window, 10) : 90,
        limit: parsed.limit ? parseInt(parsed.limit, 10) : 10,
    };
    if (out.topic === 'top-by-hour') {
        if (parsed.hour == null) {
            log('--topic top-by-hour requires --hour <0-23>.');
            process.exit(1);
        }
        const h = parseInt(parsed.hour, 10);
        if (Number.isNaN(h) || h < 0 || h > 23) {
            log('--hour must be an integer 0-23.');
            process.exit(1);
        }
        out.hour = h;
    }
    return out;
}

/**
 * Build a SQL fragment that scopes spaceMetrics rows to spaces in the
 * given city via the spaces table join (we use addressLocality match since
 * spaceMetrics has no city column directly).
 */
function buildSpaceScope(cityName: string) {
    // Returns the WHERE-clause fragment + bind params index offset
    return {
        join: 'JOIN main.spaces s ON s.id = sm."spaceId"',
        where: `sm.name IN ('space.user.visit', 'space.user.impression')
            AND sm."createdAt" >= NOW() - ($1 || ' days')::interval
            AND s."isPublic" = true
            AND s."addressLocality" ILIKE $2`,
        params: (windowDays: number) => [windowDays.toString(), `%${cityName}%`],
    };
}

async function queryHourOfDay(db: Pool, args: ICliArgs, cityName: string) {
    const scope = buildSpaceScope(cityName);
    const sql = `
        SELECT
            EXTRACT(HOUR FROM sm."createdAt" AT TIME ZONE 'UTC')::int AS hour,
            COUNT(*)::int AS visits
        FROM main."spaceMetrics" sm
        ${scope.join}
        WHERE ${scope.where}
        GROUP BY hour
        ORDER BY hour ASC
    `;
    const result = await db.query(sql, scope.params(args.windowDays));
    // Pad missing hours with zero so the consumer always gets 24 buckets.
    const byHour: Record<number, number> = {};
    result.rows.forEach((r: any) => { byHour[r.hour] = r.visits; });
    return Array.from({ length: 24 }, (_, h) => ({ hour: h, visits: byHour[h] || 0 }));
}

async function queryDayOfWeek(db: Pool, args: ICliArgs, cityName: string) {
    const scope = buildSpaceScope(cityName);
    const sql = `
        SELECT
            EXTRACT(ISODOW FROM sm."createdAt" AT TIME ZONE 'UTC')::int AS dow,
            COUNT(*)::int AS visits
        FROM main."spaceMetrics" sm
        ${scope.join}
        WHERE ${scope.where}
        GROUP BY dow
        ORDER BY dow ASC
    `;
    const result = await db.query(sql, scope.params(args.windowDays));
    const labels = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const byDow: Record<number, number> = {};
    result.rows.forEach((r: any) => { byDow[r.dow] = r.visits; });
    return Array.from({ length: 7 }, (_, i) => ({
        isoDow: i + 1,
        day: labels[i + 1],
        visits: byDow[i + 1] || 0,
    }));
}

async function queryTopByHour(db: Pool, args: ICliArgs, cityName: string) {
    const scope = buildSpaceScope(cityName);
    const sql = `
        SELECT
            s.id,
            s."notificationMsg" AS name,
            s.category,
            s."addressLocality",
            s."addressRegion",
            COUNT(*)::int AS visits
        FROM main."spaceMetrics" sm
        ${scope.join}
        WHERE ${scope.where}
          AND EXTRACT(HOUR FROM sm."createdAt" AT TIME ZONE 'UTC')::int = $3
        GROUP BY s.id, s."notificationMsg", s.category, s."addressLocality", s."addressRegion"
        ORDER BY visits DESC
        LIMIT $4
    `;
    const params = [...scope.params(args.windowDays), args.hour, args.limit];
    const result = await db.query(sql, params);
    return result.rows.map((r: any) => ({
        spaceId: r.id,
        name: r.name,
        category: r.category,
        city: r.addressLocality,
        region: r.addressRegion,
        visits: r.visits,
    }));
}

async function queryCategoryMix(db: Pool, args: ICliArgs, cityName: string) {
    const scope = buildSpaceScope(cityName);
    const sql = `
        SELECT s.category, COUNT(*)::int AS visits
        FROM main."spaceMetrics" sm
        ${scope.join}
        WHERE ${scope.where}
        GROUP BY s.category
        ORDER BY visits DESC
    `;
    const result = await db.query(sql, scope.params(args.windowDays));
    const total = result.rows.reduce((acc: number, r: any) => acc + r.visits, 0);
    return result.rows.map((r: any) => ({
        category: r.category,
        visits: r.visits,
        share: total > 0 ? Math.round((r.visits / total) * 1000) / 10 : 0, // 1 decimal place
    }));
}

async function main() {
    const args = parseArgs();
    const cityConfig = CITIES[args.city];
    if (!cityConfig) {
        log(`Unknown city slug "${args.city}".`);
        process.exit(1);
    }
    log(`Aggregating ${args.topic} for ${cityConfig.name} over last ${args.windowDays} days`);

    const db = createDbPool({ max: 3 });
    try {
        await db.query('SELECT 1');
    } catch (err: any) {
        log(`Database connection failed: ${err.message}`);
        await db.end();
        process.exit(1);
    }

    try {
        let data: unknown;
        switch (args.topic) {
            case 'hour-of-day':
                data = await queryHourOfDay(db, args, cityConfig.name);
                break;
            case 'day-of-week':
                data = await queryDayOfWeek(db, args, cityConfig.name);
                break;
            case 'top-by-hour':
                data = await queryTopByHour(db, args, cityConfig.name);
                break;
            case 'category-mix':
                data = await queryCategoryMix(db, args, cityConfig.name);
                break;
            default:
                throw new Error(`Unhandled topic: ${args.topic}`);
        }

        const output = {
            query: {
                city: cityConfig.slug,
                cityName: cityConfig.name,
                region: cityConfig.region,
                regionCode: cityConfig.regionCode,
                topic: args.topic,
                hour: args.hour,
                windowDays: args.windowDays,
                generatedAt: new Date().toISOString(),
            },
            data,
        };
        console.log(JSON.stringify(output, null, 2));
    } finally {
        await db.end();
    }
}

main().catch((err) => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
});
