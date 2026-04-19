#!/usr/bin/env node
/**
 * Discover dense, walkable clusters of spaces within a city.
 *
 * Pulls all public spaces for a (city, [optional category]) bucket, runs the
 * `clusterByRadius` heuristic from `utils/geo.ts`, and ranks clusters by
 * *completeness-weighted density*: the sum of member completeness scores
 * divided by the cluster's effective area (πr² where r = diameter/2, with a
 * 100m floor to avoid divide-by-near-zero on overlapping points). Completeness
 * weighting matters because a cluster of 6 well-documented spaces beats a
 * cluster of 8 skeletal ones for editorial purposes.
 *
 * Output rows describe each cluster: centroid, diameter, walking-time estimate,
 * and a trimmed list of member spaces with address + completeness columns so
 * the caller can pick a cluster for a walkable-route post without a second
 * query round-trip.
 *
 * Usage:
 *   npx ts-node scripts/generate-content/discover-clusters \
 *     --city chicago [--category bar/drinks] [--limit 10] \
 *     [--minSize 4] [--maxSize 8] [--maxDiameter 1500]
 *
 * Stdout: JSON envelope `{ query, clusters }`.
 * Stderr: progress logs.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES } from '../import-spaces/config';
import { createDbPool } from '../import-spaces/utils/db';
import {
    clusterByRadius,
    walkingMinutes,
    IGeoSpace,
} from './utils/geo';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../import-spaces/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function log(msg: string) {
    process.stderr.write(`${msg}\n`);
}

interface ICliArgs {
    city: string;
    category: string;
    limit: number;
    minSize: number;
    maxSize: number;
    maxDiameter: number;
}

function parseArgs(): ICliArgs {
    const args = process.argv.slice(2);
    const parsed: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('--')) {
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                parsed[a.replace('--', '')] = next;
                i++;
            }
        }
    }
    if (!parsed.city) {
        log('Missing required --city <slug>. See scripts/import-spaces/config.ts for valid city slugs.');
        process.exit(1);
    }
    return {
        city: parsed.city,
        category: parsed.category || '',
        limit: parsed.limit ? parseInt(parsed.limit, 10) : 10,
        minSize: parsed.minSize ? parseInt(parsed.minSize, 10) : 4,
        maxSize: parsed.maxSize ? parseInt(parsed.maxSize, 10) : 8,
        maxDiameter: parsed.maxDiameter ? parseInt(parsed.maxDiameter, 10) : 1500,
    };
}

interface ICandidateRow {
    id: string;
    name: string;
    category: string;
    addressStreetAddress: string | null;
    addressLocality: string | null;
    addressRegion: string | null;
    latitude: number;
    longitude: number;
    websiteUrl: string | null;
    phoneNumber: string | null;
    description: string | null;
    hashTags: string | null;
    has_media: boolean;
    completeness_score: number;
}

interface IClusterSpace extends IGeoSpace {
    row: ICandidateRow;
}

async function queryCandidates(db: Pool, args: ICliArgs) {
    const cityConfig = CITIES[args.city];
    if (!cityConfig) {
        log(`Unknown city slug "${args.city}". Available: ${Object.keys(CITIES).slice(0, 10).join(', ')}, ...`);
        process.exit(1);
    }

    const params: (string | number)[] = [`%${cityConfig.name}%`];
    let categoryFilter = '';
    if (args.category) {
        params.push(args.category);
        categoryFilter = `AND s.category = $${params.length}`;
    }

    const sql = `
        SELECT
            s.id,
            s."notificationMsg" AS name,
            s.category,
            s."addressStreetAddress",
            s."addressLocality",
            s."addressRegion",
            s.latitude,
            s.longitude,
            s."websiteUrl",
            s."phoneNumber",
            s.message AS description,
            s."hashTags",
            (s."mediaIds" IS NOT NULL AND s."mediaIds" != '')
                OR (s.medias IS NOT NULL AND jsonb_array_length(s.medias) > 0) AS has_media,
            (
                (CASE WHEN s."websiteUrl" IS NOT NULL AND s."websiteUrl" != '' THEN 1 ELSE 0 END)
                + (CASE WHEN s."phoneNumber" IS NOT NULL AND s."phoneNumber" != '' THEN 1 ELSE 0 END)
                + (CASE WHEN s."addressStreetAddress" IS NOT NULL AND s."addressStreetAddress" != '' THEN 1 ELSE 0 END)
                + (CASE WHEN s.message IS NOT NULL AND length(s.message) >= 60 THEN 1 ELSE 0 END)
                + (CASE WHEN (s."mediaIds" IS NOT NULL AND s."mediaIds" != '')
                        OR (s.medias IS NOT NULL AND jsonb_array_length(s.medias) > 0) THEN 1 ELSE 0 END)
            )::int AS completeness_score
        FROM main.spaces s
        WHERE s."isPublic" = true
          AND s."addressLocality" ILIKE $1
          AND s.latitude IS NOT NULL
          AND s.longitude IS NOT NULL
          ${categoryFilter}
    `;

    const result = await db.query(sql, params);
    return { city: cityConfig, rows: result.rows as ICandidateRow[] };
}

function densityScore(sumCompleteness: number, diameter: number): number {
    // Floor the radius at 100m (~π·0.03 km²) so clusters of near-duplicate
    // lat/lngs don't blow up the density score. Editorial-wise, 4 spaces in a
    // single building isn't a "walkable route" — it's a building.
    const radius = Math.max(100, diameter / 2);
    const areaKm2 = Math.PI * (radius / 1000) ** 2;
    return sumCompleteness / areaKm2;
}

async function main() {
    const args = parseArgs();
    log(`Discovering clusters: city=${args.city}${args.category ? ` category=${args.category}` : ''} `
        + `minSize=${args.minSize} maxSize=${args.maxSize} maxDiameter=${args.maxDiameter}m limit=${args.limit}`);

    const db = createDbPool({ max: 3 });
    try {
        await db.query('SELECT 1');
    } catch (err: any) {
        log(`Database connection failed: ${err.message}`);
        await db.end();
        process.exit(1);
    }

    try {
        const { city, rows } = await queryCandidates(db, args);
        log(`Fetched ${rows.length} candidate spaces with coordinates.`);

        const geoSpaces: IClusterSpace[] = rows.map((r) => ({
            id: r.id,
            lat: Number(r.latitude),
            lng: Number(r.longitude),
            weight: Number(r.completeness_score) || 0,
            row: r,
        }));

        const clusters = clusterByRadius(geoSpaces, {
            maxDiameterMeters: args.maxDiameter,
            minSize: args.minSize,
            maxSize: args.maxSize,
        });
        log(`Formed ${clusters.length} candidate clusters before ranking.`);

        const ranked = clusters
            .map((c) => {
                const diameter = c.diameterMeters;
                const sumCompleteness = c.spaces.reduce(
                    (acc, s) => acc + (Number(s.row.completeness_score) || 0),
                    0,
                );
                return {
                    cluster: c,
                    diameter,
                    sumCompleteness,
                    density: densityScore(sumCompleteness, diameter),
                    memberCount: c.spaces.length,
                };
            })
            .sort((a, b) => b.density - a.density)
            .slice(0, args.limit);

        log(`Ranked; returning top ${ranked.length} clusters.`);

        const output = {
            query: {
                city: city.slug,
                cityName: city.name,
                region: city.region,
                regionCode: city.regionCode,
                country: city.country,
                category: args.category || null,
                minSize: args.minSize,
                maxSize: args.maxSize,
                maxDiameterMeters: args.maxDiameter,
                generatedAt: new Date().toISOString(),
            },
            totals: {
                candidates: rows.length,
                clusters: clusters.length,
                returned: ranked.length,
            },
            clusters: ranked.map((rc, idx) => ({
                rank: idx + 1,
                centroid: rc.cluster.centroid,
                diameterMeters: Math.round(rc.diameter),
                walkingMinutes: walkingMinutes(rc.diameter),
                memberCount: rc.memberCount,
                sumCompleteness: rc.sumCompleteness,
                density: Number(rc.density.toFixed(2)),
                categories: Array.from(new Set(rc.cluster.spaces.map((s) => s.row.category))).sort(),
                spaces: rc.cluster.spaces.map((s) => ({
                    id: s.row.id,
                    name: s.row.name,
                    category: s.row.category,
                    lat: s.lat,
                    lng: s.lng,
                    address: {
                        street: s.row.addressStreetAddress || null,
                        city: s.row.addressLocality || null,
                        region: s.row.addressRegion || null,
                    },
                    completenessScore: Number(s.row.completeness_score) || 0,
                    hasWebsite: !!s.row.websiteUrl,
                    hasPhone: !!s.row.phoneNumber,
                    hasMedia: !!s.row.has_media,
                })),
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
