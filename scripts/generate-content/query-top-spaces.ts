#!/usr/bin/env node
/**
 * Query top-ranked spaces in a city/category for editorial list posts.
 *
 * Two ranking modes:
 *   - `engagement` (default): rank by visits * 5 + impressions over the time window.
 *     Good when a city/category has enough activity to back a "ranked by community visits"
 *     framing.
 *   - `curated`: rank by completeness of editorial metadata (website, media, description,
 *     phone, full address). Good when engagement data is thin and we shouldn't claim a
 *     popularity-based ranking.
 *
 * Mode selection:
 *   - Pass `--mode curated` (or `--curated`) to force curated ranking.
 *   - Pass `--mode engagement` to force engagement ranking.
 *   - Default `--mode auto` picks engagement, then *automatically falls back* to curated
 *     if total visits across the result set is below `--minVisits` (default 25). The
 *     selected mode is reported in the JSON output so the LLM can frame the post honestly.
 *
 * Usage:
 *   npx ts-node scripts/generate-content/query-top-spaces \
 *     --city cincinnati --category bar/drinks --limit 15 --window 90
 *   npx ts-node scripts/generate-content/query-top-spaces \
 *     --city denver --category cafe --curated --limit 10
 *
 * Stdout: JSON envelope `{ query, mode, modeReason, spaces }` (no secrets).
 * Stderr: progress logs.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES } from '../import-spaces/config';
import { createDbPool } from '../import-spaces/utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../import-spaces/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function log(msg: string) {
    process.stderr.write(`${msg}\n`);
}

type RankMode = 'auto' | 'engagement' | 'curated';

interface ICliArgs {
    city: string;
    category: string;
    limit: number;
    windowDays: number;
    mode: RankMode;
    minVisits: number;
    minTopVisits: number;
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

    if (!parsed.city) {
        log('Missing required --city <slug>. See scripts/import-spaces/config.ts for valid city slugs.');
        process.exit(1);
    }
    if (!parsed.category) {
        log('Missing required --category <name>. Examples: bar/drinks, restaurant/food, cafe.');
        process.exit(1);
    }

    let mode: RankMode = (parsed.mode as RankMode) || 'auto';
    if (flags.has('curated')) mode = 'curated';
    if (flags.has('engagement')) mode = 'engagement';
    if (!['auto', 'engagement', 'curated'].includes(mode)) {
        log(`Invalid --mode "${mode}". Must be auto | engagement | curated.`);
        process.exit(1);
    }

    return {
        city: parsed.city,
        category: parsed.category,
        limit: parsed.limit ? parseInt(parsed.limit, 10) : 15,
        windowDays: parsed.window ? parseInt(parsed.window, 10) : 90,
        mode,
        minVisits: parsed.minVisits ? parseInt(parsed.minVisits, 10) : 25,
        minTopVisits: parsed.minTopVisits ? parseInt(parsed.minTopVisits, 10) : 5,
    };
}

interface IRawSpaceRow {
    id: string;
    name: string;
    category: string;
    addressStreetAddress: string | null;
    addressLocality: string | null;
    addressRegion: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
    websiteUrl: string | null;
    phoneNumber: string | null;
    mediaIds: string | null;
    medias: any;
    description: string | null;
    hashTags: string | null;
    createdAt: string;
    visit_count: string | number;
    unique_visitors: string | number;
    impression_count: string | number;
    score: string | number;
    has_media: boolean;
    completeness_score: string | number;
}

async function queryRankedSpaces(db: Pool, args: ICliArgs) {
    const cityConfig = CITIES[args.city];
    if (!cityConfig) {
        log(`Unknown city slug "${args.city}". Available: ${Object.keys(CITIES).slice(0, 10).join(', ')}, ...`);
        process.exit(1);
    }

    // Base query: select all candidates with both engagement and completeness columns.
    // The ORDER BY is decided after we inspect the engagement totals (so we can fall back
    // gracefully) — we fetch a pool of candidates by completeness OR engagement and then
    // sort and slice in-process. This keeps the SQL simple and lets the calling layer pick
    // the mode label honestly.
    const candidateLimit = Math.max(args.limit * 4, 40);

    const query = `
        SELECT
            s.id,
            s."notificationMsg" AS name,
            s.category,
            s."addressStreetAddress",
            s."addressLocality",
            s."addressRegion",
            s."postalCode",
            s.latitude,
            s.longitude,
            s."websiteUrl",
            s."phoneNumber",
            s."mediaIds",
            s.medias,
            s.message AS description,
            s."hashTags",
            s."createdAt",
            COALESCE(v.visits, 0) AS visit_count,
            COALESCE(v.unique_visitors, 0) AS unique_visitors,
            COALESCE(i.impressions, 0) AS impression_count,
            COALESCE(v.visits, 0) * 5 + COALESCE(i.impressions, 0) AS score,
            (s."mediaIds" IS NOT NULL AND s."mediaIds" != '')
                OR (s.medias IS NOT NULL AND jsonb_array_length(s.medias) > 0) AS has_media,
            (
                (CASE WHEN s."websiteUrl" IS NOT NULL AND s."websiteUrl" != '' THEN 1 ELSE 0 END)
                + (CASE WHEN s."phoneNumber" IS NOT NULL AND s."phoneNumber" != '' THEN 1 ELSE 0 END)
                + (CASE WHEN s."addressStreetAddress" IS NOT NULL AND s."addressStreetAddress" != '' THEN 1 ELSE 0 END)
                + (CASE WHEN s.message IS NOT NULL AND length(s.message) >= 60 THEN 1 ELSE 0 END)
                + (CASE WHEN (s."mediaIds" IS NOT NULL AND s."mediaIds" != '')
                        OR (s.medias IS NOT NULL AND jsonb_array_length(s.medias) > 0) THEN 1 ELSE 0 END)
            ) AS completeness_score
        FROM main.spaces s
        LEFT JOIN (
            SELECT
                "spaceId",
                COUNT(*) AS visits,
                COUNT(DISTINCT "userId") AS unique_visitors
            FROM main."spaceMetrics"
            WHERE name = 'space.user.visit'
              AND "createdAt" >= NOW() - ($1 || ' days')::interval
            GROUP BY "spaceId"
        ) v ON v."spaceId" = s.id
        LEFT JOIN (
            SELECT
                "spaceId",
                COUNT(*) AS impressions
            FROM main."spaceMetrics"
            WHERE name = 'space.user.impression'
              AND "createdAt" >= NOW() - ($1 || ' days')::interval
            GROUP BY "spaceId"
        ) i ON i."spaceId" = s.id
        WHERE s."isPublic" = true
          AND s.category = $2
          AND s."addressLocality" ILIKE $3
        ORDER BY completeness_score DESC, score DESC, s."createdAt" DESC
        LIMIT $4
    `;

    const params: (string | number)[] = [
        args.windowDays.toString(),
        args.category,
        `%${cityConfig.name}%`,
        candidateLimit,
    ];

    const result = await db.query(query, params);
    return { city: cityConfig, rows: result.rows as IRawSpaceRow[] };
}

function pickModeAndSort(args: ICliArgs, rows: IRawSpaceRow[]): { mode: 'engagement' | 'curated'; reason: string; sorted: IRawSpaceRow[] } {
    const totalVisits = rows.reduce((acc, r) => acc + Number(r.visit_count || 0), 0);
    const totalImpressions = rows.reduce((acc, r) => acc + Number(r.impression_count || 0), 0);
    const topVisits = rows.reduce((acc, r) => Math.max(acc, Number(r.visit_count || 0)), 0);

    let mode: 'engagement' | 'curated';
    let reason: string;

    if (args.mode === 'curated') {
        mode = 'curated';
        reason = 'Forced via --curated flag.';
    } else if (args.mode === 'engagement') {
        mode = 'engagement';
        reason = 'Forced via --mode engagement.';
    } else if (totalVisits < args.minVisits) {
        mode = 'curated';
        reason = `Auto-fallback: total visits ${totalVisits} < minVisits ${args.minVisits} (impressions=${totalImpressions}). Cannot honestly rank by community engagement.`;
    } else if (topVisits < args.minTopVisits) {
        mode = 'curated';
        reason = `Auto-fallback: top space has only ${topVisits} visits (< minTopVisits ${args.minTopVisits}). Engagement is too flat to support a "most-visited" framing.`;
    } else {
        mode = 'engagement';
        reason = `Engagement signal sufficient: total visits ${totalVisits} (top=${topVisits}, impressions=${totalImpressions}) across ${rows.length} candidates.`;
    }

    const sorted = [...rows].sort((a, b) => {
        if (mode === 'engagement') {
            const sa = Number(a.score || 0);
            const sb = Number(b.score || 0);
            if (sa !== sb) return sb - sa;
            const ca = Number(a.completeness_score || 0);
            const cb = Number(b.completeness_score || 0);
            if (ca !== cb) return cb - ca;
        } else {
            const ca = Number(a.completeness_score || 0);
            const cb = Number(b.completeness_score || 0);
            if (ca !== cb) return cb - ca;
            const sa = Number(a.score || 0);
            const sb = Number(b.score || 0);
            if (sa !== sb) return sb - sa;
        }
        const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTs - aTs;
    });

    return { mode, reason, sorted };
}

async function main() {
    const args = parseArgs();
    log(`Querying top spaces: city=${args.city}, category=${args.category}, limit=${args.limit}, window=${args.windowDays}d, mode=${args.mode}`);

    const db = createDbPool({ max: 3 });
    try {
        await db.query('SELECT 1');
    } catch (err: any) {
        log(`Database connection failed: ${err.message}`);
        await db.end();
        process.exit(1);
    }

    try {
        const { city, rows } = await queryRankedSpaces(db, args);
        const { mode, reason, sorted } = pickModeAndSort(args, rows);
        const finalRows = sorted.slice(0, args.limit);
        log(`Found ${rows.length} candidates; returning ${finalRows.length} via mode=${mode}.`);
        log(reason);

        const output = {
            query: {
                city: city.slug,
                cityName: city.name,
                region: city.region,
                regionCode: city.regionCode,
                country: city.country,
                category: args.category,
                windowDays: args.windowDays,
                generatedAt: new Date().toISOString(),
            },
            mode,
            modeReason: reason,
            totals: {
                candidates: rows.length,
                returned: finalRows.length,
                visits: rows.reduce((a, r) => a + Number(r.visit_count || 0), 0),
                impressions: rows.reduce((a, r) => a + Number(r.impression_count || 0), 0),
            },
            spaces: finalRows.map((r) => ({
                id: r.id,
                name: r.name,
                category: r.category,
                description: r.description || null,
                hashTags: r.hashTags || null,
                address: {
                    street: r.addressStreetAddress || null,
                    city: r.addressLocality || null,
                    region: r.addressRegion || null,
                    postalCode: r.postalCode || null,
                },
                websiteUrl: r.websiteUrl || null,
                phoneNumber: r.phoneNumber || null,
                hasMedia: !!r.has_media,
                completeness: {
                    score: Number(r.completeness_score) || 0,
                    hasWebsite: !!r.websiteUrl,
                    hasPhone: !!r.phoneNumber,
                    hasAddress: !!r.addressStreetAddress,
                    hasDescription: !!(r.description && r.description.length >= 60),
                    hasMedia: !!r.has_media,
                },
                metrics: {
                    visits: Number(r.visit_count) || 0,
                    uniqueVisitors: Number(r.unique_visitors) || 0,
                    impressions: Number(r.impression_count) || 0,
                    score: Number(r.score) || 0,
                },
            })),
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
