#!/usr/bin/env node
/**
 * Query a walkable cluster and order its members into a route.
 *
 * Two entry modes:
 *   1. `--spaceIds <id1,id2,...>` — use the exact cluster returned by
 *      `discover-clusters.ts`. Spaces are loaded by id, ordered via
 *      nearest-neighbor TSP starting from the highest-completeness member.
 *      This is the typical editorial workflow: run discover-clusters, pick a
 *      cluster, feed its ids back in.
 *   2. `--center <lat,lng> --radius <meters>` — pull all spaces inside the
 *      bounding circle, re-cluster, pick the cluster whose centroid is
 *      closest to the requested center, then order. Useful when we already
 *      know a neighborhood's lat/lng but haven't pre-discovered clusters for
 *      it (e.g., editorial pitch: "Wicker Park").
 *
 * Either mode emits the same output shape: `{ query, cluster, route }` where
 * `route.stops[]` is the ordered list with `walkFromPreviousMeters` set on
 * stops 2..N, and `route.totalMeters` / `route.estimatedMinutes` describe the
 * full path. This is the exact payload the `walkable-route` section type
 * wants, minus the editorial `note` strings (LLM fills those in).
 *
 * Usage:
 *   npx ts-node scripts/generate-content/query-walkable-cluster \
 *     --spaceIds "abc-123,def-456,..."
 *   npx ts-node scripts/generate-content/query-walkable-cluster \
 *     --center 41.908,-87.678 --radius 800 [--category bar/drinks] \
 *     [--minSize 4] [--maxSize 8] [--maxDiameter 1500]
 *
 * Stdout: JSON envelope `{ query, cluster, route }`.
 * Stderr: progress logs.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { createDbPool } from '../import-spaces/utils/db';
import {
    clusterByRadius,
    haversineMeters,
    orderAsWalkingRoute,
    walkingMinutes,
    IGeoSpace,
    ILatLng,
} from './utils/geo';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../import-spaces/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function log(msg: string) {
    process.stderr.write(`${msg}\n`);
}

interface ICliArgs {
    spaceIds: string[];
    center: ILatLng | null;
    radius: number;
    category: string;
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

    const spaceIds = parsed.spaceIds
        ? parsed.spaceIds.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    let center: ILatLng | null = null;
    if (parsed.center) {
        const parts = parsed.center.split(',').map((s) => s.trim());
        if (parts.length !== 2) {
            log(`Invalid --center "${parsed.center}". Expected "lat,lng".`);
            process.exit(1);
        }
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            log(`Invalid --center "${parsed.center}". Lat/lng must be numeric.`);
            process.exit(1);
        }
        center = { lat, lng };
    }

    if (spaceIds.length === 0 && !center) {
        log('Missing required input. Provide either --spaceIds <csv> or --center <lat,lng> --radius <m>.');
        process.exit(1);
    }
    if (spaceIds.length > 0 && center) {
        log('Both --spaceIds and --center supplied. Using --spaceIds; --center will be ignored.');
    }

    return {
        spaceIds,
        center,
        radius: parsed.radius ? parseInt(parsed.radius, 10) : 800,
        category: parsed.category || '',
        minSize: parsed.minSize ? parseInt(parsed.minSize, 10) : 4,
        maxSize: parsed.maxSize ? parseInt(parsed.maxSize, 10) : 8,
        maxDiameter: parsed.maxDiameter ? parseInt(parsed.maxDiameter, 10) : 1500,
    };
}

interface ISpaceRow {
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

interface IGeoRow extends IGeoSpace {
    row: ISpaceRow;
}

const SELECT_COLUMNS = `
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
`;

async function queryByIds(db: Pool, spaceIds: string[]): Promise<ISpaceRow[]> {
    const sql = `
        SELECT ${SELECT_COLUMNS}
        FROM main.spaces s
        WHERE s.id = ANY($1::uuid[])
          AND s."isPublic" = true
          AND s.latitude IS NOT NULL
          AND s.longitude IS NOT NULL
    `;
    const result = await db.query(sql, [spaceIds]);
    return result.rows as ISpaceRow[];
}

async function queryByCenter(db: Pool, center: ILatLng, radiusMeters: number, category: string): Promise<ISpaceRow[]> {
    // Prefilter by a lat/lng bounding box, then Haversine-filter in-process.
    // ~111km per degree of latitude; longitude scales by cos(lat). We pad the
    // box by 10% so spaces at the edge of the radius are not missed because
    // of cos approximation error at higher latitudes.
    const padding = 1.1;
    const latDelta = (radiusMeters / 111_000) * padding;
    const lngDelta = (radiusMeters / (111_000 * Math.cos((center.lat * Math.PI) / 180))) * padding;

    const params: (string | number)[] = [
        center.lat - latDelta,
        center.lat + latDelta,
        center.lng - lngDelta,
        center.lng + lngDelta,
    ];
    let categoryFilter = '';
    if (category) {
        params.push(category);
        categoryFilter = `AND s.category = $${params.length}`;
    }

    const sql = `
        SELECT ${SELECT_COLUMNS}
        FROM main.spaces s
        WHERE s."isPublic" = true
          AND s.latitude BETWEEN $1 AND $2
          AND s.longitude BETWEEN $3 AND $4
          ${categoryFilter}
    `;
    const result = await db.query(sql, params);
    const rows = result.rows as ISpaceRow[];

    return rows.filter((r) => (
        haversineMeters(center, { lat: Number(r.latitude), lng: Number(r.longitude) }) <= radiusMeters
    ));
}

function pickClusterByCenter<T extends IGeoSpace>(
    clusters: ReturnType<typeof clusterByRadius<T>>,
    center: ILatLng,
): ReturnType<typeof clusterByRadius<T>>[number] | null {
    if (clusters.length === 0) return null;
    // Prefer the cluster whose centroid is closest to the requested center.
    return clusters.reduce((best, c) => (
        haversineMeters(c.centroid, center) < haversineMeters(best.centroid, center) ? c : best
    ), clusters[0]);
}

function toGeoRows(rows: ISpaceRow[]): IGeoRow[] {
    return rows.map((r) => ({
        id: r.id,
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        weight: Number(r.completeness_score) || 0,
        row: r,
    }));
}

function formatStop(order: number, space: IGeoRow, walkFromPreviousMeters?: number) {
    // Note: the `order`, `spaceId`, `name`, `lat`, `lng`, and `walkFromPreviousMeters`
    // fields map directly to `IWalkableRouteStop` in utils/contentSchema.ts.
    // The additional fields (address, completeness, etc.) are diagnostic for the
    // editorial caller; they are not part of the stored section payload.
    return {
        order,
        spaceId: space.row.id,
        name: space.row.name,
        lat: space.lat,
        lng: space.lng,
        category: space.row.category,
        address: {
            street: space.row.addressStreetAddress || null,
            city: space.row.addressLocality || null,
            region: space.row.addressRegion || null,
        },
        completenessScore: Number(space.row.completeness_score) || 0,
        hasWebsite: !!space.row.websiteUrl,
        hasPhone: !!space.row.phoneNumber,
        hasMedia: !!space.row.has_media,
        ...(walkFromPreviousMeters != null
            ? {
                walkFromPreviousMeters: Math.round(walkFromPreviousMeters),
                walkFromPreviousMinutes: walkingMinutes(walkFromPreviousMeters),
            }
            : {}),
    };
}

async function main() {
    const args = parseArgs();
    const db = createDbPool({ max: 3 });
    try {
        await db.query('SELECT 1');
    } catch (err: any) {
        log(`Database connection failed: ${err.message}`);
        await db.end();
        process.exit(1);
    }

    try {
        let spacesForRoute: IGeoRow[];
        let source: 'spaceIds' | 'center';

        if (args.spaceIds.length > 0) {
            source = 'spaceIds';
            log(`Loading ${args.spaceIds.length} spaces by id.`);
            const rows = await queryByIds(db, args.spaceIds);
            if (rows.length === 0) {
                log('No spaces matched the supplied ids. Nothing to route.');
                process.exit(1);
            }
            if (rows.length < args.spaceIds.length) {
                log(`Warning: only ${rows.length} of ${args.spaceIds.length} ids returned public rows with coords.`);
            }
            spacesForRoute = toGeoRows(rows);
        } else {
            source = 'center';
            const center = args.center as ILatLng;
            log(`Querying spaces within ${args.radius}m of ${center.lat},${center.lng}`
                + `${args.category ? ` (category=${args.category})` : ''}.`);
            const rows = await queryByCenter(db, center, args.radius, args.category);
            log(`Fetched ${rows.length} candidate spaces in radius.`);
            if (rows.length === 0) {
                log('No candidates in the requested radius.');
                process.exit(1);
            }

            const geoRows = toGeoRows(rows);
            const clusters = clusterByRadius(geoRows, {
                maxDiameterMeters: args.maxDiameter,
                minSize: args.minSize,
                maxSize: args.maxSize,
            });
            log(`Found ${clusters.length} clusters; selecting the one closest to the requested center.`);
            const picked = pickClusterByCenter(clusters, center);
            if (!picked) {
                log(`No cluster of size >= ${args.minSize} found within ${args.maxDiameter}m diameter.`);
                process.exit(1);
            }
            spacesForRoute = picked.spaces;
        }

        const clusterForRoute = {
            spaces: spacesForRoute,
            centroid: {
                lat: spacesForRoute.reduce((a, s) => a + s.lat, 0) / spacesForRoute.length,
                lng: spacesForRoute.reduce((a, s) => a + s.lng, 0) / spacesForRoute.length,
            },
            diameterMeters: 0, // not used by orderAsWalkingRoute; left as 0
        };
        const { ordered, legs, totalMeters } = orderAsWalkingRoute(clusterForRoute);

        const stops = ordered.map((space, idx) => formatStop(idx + 1, space, idx === 0 ? undefined : legs[idx - 1]));

        const output = {
            query: {
                source,
                spaceIdsIn: args.spaceIds.length > 0 ? args.spaceIds : null,
                center: args.center,
                radiusMeters: args.center ? args.radius : null,
                category: args.category || null,
                generatedAt: new Date().toISOString(),
            },
            cluster: {
                centroid: clusterForRoute.centroid,
                memberCount: spacesForRoute.length,
                categories: Array.from(new Set(spacesForRoute.map((s) => s.row.category))).sort(),
            },
            route: {
                totalMeters: Math.round(totalMeters),
                estimatedMinutes: walkingMinutes(totalMeters),
                stops,
            },
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
