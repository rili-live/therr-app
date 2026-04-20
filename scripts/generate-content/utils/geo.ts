/**
 * Geographic utilities for walkable-cluster guides.
 *
 * Pure functions: no DB, no I/O, no env. Used by `discover-clusters.ts`,
 * `query-walkable-cluster.ts`, and (for ordering) when composing the
 * `walkable-route` section payload.
 *
 * See docs/CONTENT_WALKABLE_CLUSTERS_PLAN.md.
 */

export interface ILatLng {
    lat: number;
    lng: number;
}

/** A space annotated with enough identity to cluster and order. */
export interface IGeoSpace extends ILatLng {
    id: string;
    /** Optional rank hint; used to bias cluster seed selection. Higher = better. */
    weight?: number;
}

const EARTH_RADIUS_METERS = 6371008.8;
/** Typical adult walking pace, conservative for an urban browse. */
const WALKING_METERS_PER_MINUTE = 80;

/**
 * Great-circle distance between two lat/lng points, in meters. Haversine —
 * accurate enough for city-scale clustering (<~20km). Clamps the inner
 * argument to [0,1] to guard against floating-point drift when the two
 * points are identical.
 */
export function haversineMeters(a: ILatLng, b: ILatLng): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
    return EARTH_RADIUS_METERS * c;
}

/** Rough walking time for a given distance, in whole minutes. */
export function walkingMinutes(meters: number): number {
    if (!Number.isFinite(meters) || meters <= 0) return 0;
    return Math.max(1, Math.round(meters / WALKING_METERS_PER_MINUTE));
}

/** Centroid (simple mean) of a non-empty list of lat/lng points. */
export function centroidOf(points: ILatLng[]): ILatLng {
    if (points.length === 0) {
        throw new Error('centroidOf: empty points array');
    }
    let sumLat = 0;
    let sumLng = 0;
    for (const p of points) {
        sumLat += p.lat;
        sumLng += p.lng;
    }
    return { lat: sumLat / points.length, lng: sumLng / points.length };
}

/**
 * Maximum pairwise distance (in meters) across a set of points — the cluster's
 * "diameter". This is the honest walking-crawl metric: the longest single hop a
 * visitor would face inside the cluster. Centroid-radius would understate it.
 */
export function diameterMeters(points: ILatLng[]): number {
    let max = 0;
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const d = haversineMeters(points[i], points[j]);
            if (d > max) max = d;
        }
    }
    return max;
}

function pickStart<T extends IGeoSpace>(members: T[], centroid: ILatLng): T {
    const topWeight = members.reduce((acc, m) => Math.max(acc, m.weight ?? 0), 0);
    const topMembers = members.filter((m) => (m.weight ?? 0) === topWeight);
    if (topMembers.length === 1) return topMembers[0];
    // Tie-break by closeness to centroid (nicely positioned routes start near the middle).
    return topMembers.reduce((best, m) => (
        haversineMeters(m, centroid) < haversineMeters(best, centroid) ? m : best
    ), topMembers[0]);
}

export interface ICluster<T extends IGeoSpace> {
    /** Members of the cluster. Order is not meaningful here — call `orderAsWalkingRoute` for that. */
    spaces: T[];
    /** Simple mean of member coordinates. */
    centroid: ILatLng;
    /** Max pairwise distance across members, in meters. */
    diameterMeters: number;
}

export interface IClusterOptions {
    /**
     * Upper bound on pairwise distance within a cluster (meters). A cluster
     * must satisfy `diameterMeters(cluster) <= maxDiameterMeters`, otherwise
     * members are split. Defaults to 1500m (~a ~19-min walk tip-to-tip,
     * comfortably sized for a neighborhood crawl).
     */
    maxDiameterMeters?: number;
    /** Minimum cluster size. Default 4. */
    minSize?: number;
    /** Maximum cluster size. Default 8. Excess members are dropped by lowest weight. */
    maxSize?: number;
}

/**
 * Greedy agglomerative-ish clustering tuned for editorial-list density:
 *
 * 1. Seed from the highest-weight space not yet assigned.
 * 2. Walk neighbors (sorted by distance) and add them as long as the resulting
 *    cluster's diameter stays within `maxDiameterMeters`.
 * 3. Stop when the cluster hits `maxSize`, or no more neighbors fit.
 * 4. Discard clusters smaller than `minSize`.
 *
 * This is intentionally simpler than DBSCAN — editorial clusters want a few
 * clean, dense pockets, not full partitioning of the city. Noise / outliers
 * just don't appear in output.
 */
export function clusterByRadius<T extends IGeoSpace>(
    spaces: T[],
    options: IClusterOptions = {},
): ICluster<T>[] {
    const maxDiameter = options.maxDiameterMeters ?? 1500;
    const minSize = options.minSize ?? 4;
    const maxSize = options.maxSize ?? 8;

    // Filter out spaces without valid coordinates up front.
    const candidates = spaces.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    // Descending by weight, then stable by id for determinism.
    const seedOrder = [...candidates].sort((a, b) => {
        const wa = a.weight ?? 0;
        const wb = b.weight ?? 0;
        if (wa !== wb) return wb - wa;
        return a.id.localeCompare(b.id);
    });

    const used = new Set<string>();
    const clusters: ICluster<T>[] = [];

    for (const seed of seedOrder) {
        if (!used.has(seed.id)) {
            const members: T[] = [seed];
            const neighbors = candidates
                .filter((s) => s.id !== seed.id && !used.has(s.id))
                .map((s) => ({ space: s, d: haversineMeters(seed, s) }))
                .sort((a, b) => a.d - b.d);

            for (const { space } of neighbors) {
                if (members.length >= maxSize) break;
                const tentative = [...members, space];
                if (diameterMeters(tentative) <= maxDiameter) {
                    members.push(space);
                }
            }

            if (members.length >= minSize) {
                for (const m of members) used.add(m.id);
                clusters.push({
                    spaces: members,
                    centroid: centroidOf(members),
                    diameterMeters: diameterMeters(members),
                });
            }
            // If under minSize, leave other members unassigned so a weaker seed can retry them.
            // Mark only the seed as used so we don't retry it.
            used.add(seed.id);
        }
    }

    return clusters;
}

/**
 * Order cluster members into a walking route using a nearest-neighbor
 * heuristic. Starts at the highest-weight member (falling back to the one
 * closest to the centroid if weights are equal or absent), then repeatedly
 * visits the unvisited member closest to the current position.
 *
 * Returns `[ordered members, legs]` where `legs[i]` is the walking distance
 * in meters from `ordered[i]` to `ordered[i+1]` (so `legs.length === ordered.length - 1`).
 *
 * Nearest-neighbor is not optimal TSP but it's excellent for clusters of 4–8
 * at neighborhood scale — and the resulting route is readable ("start at A,
 * walk to B, then C…") which is the editorial goal.
 */
export function orderAsWalkingRoute<T extends IGeoSpace>(
    cluster: ICluster<T>,
): { ordered: T[]; legs: number[]; totalMeters: number } {
    const members = cluster.spaces;
    if (members.length === 0) return { ordered: [], legs: [], totalMeters: 0 };
    if (members.length === 1) return { ordered: [members[0]], legs: [], totalMeters: 0 };

    const start = pickStart(members, cluster.centroid);
    const remaining = new Map(members.filter((m) => m.id !== start.id).map((m) => [m.id, m]));

    const ordered: T[] = [start];
    const legs: number[] = [];
    let current: T = start;
    while (remaining.size > 0) {
        let nextEntry: T | null = null;
        let nextDist = Infinity;
        for (const m of remaining.values()) {
            const d = haversineMeters(current, m);
            if (d < nextDist) {
                nextDist = d;
                nextEntry = m;
            }
        }
        if (nextEntry === null) break;
        remaining.delete(nextEntry.id);
        legs.push(nextDist);
        ordered.push(nextEntry);
        current = nextEntry;
    }

    const totalMeters = legs.reduce((acc, x) => acc + x, 0);
    return { ordered, legs, totalMeters };
}
