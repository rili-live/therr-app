/** Metres per degree of latitude. Constant everywhere; longitude's shrinks toward the poles. */
const METERS_PER_DEGREE_LATITUDE = 111320;

/**
 * Floor on cos(latitude) when converting metres to degrees of longitude.
 *
 * At the poles cos() reaches 0 and the conversion divides by zero, producing an infinite
 * span. 0.01 corresponds to ~89.4°, past which the box simply covers all longitudes —
 * which is the geometrically correct answer there anyway.
 */
const MIN_LATITUDE_COSINE = 0.01;

export interface IBoundingBox {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    /**
     * True when the box would wrap past ±180° longitude. Callers doing an indexed
     * `BETWEEN` on longitude must drop that predicate when this is set — a wrapped range
     * has a min greater than its max, which matches nothing. Latitude never wraps.
     */
    wrapsAntimeridian: boolean;
}

/**
 * The smallest lat/long rectangle containing every point within `radiusMeters` of a centre.
 *
 * This exists to make a radius search index-friendly. An exact distance test
 * (`ST_DWithin`, haversine) cannot use a btree index, so it is run against every candidate
 * row; bounding the query to this rectangle first lets a `(latitude, longitude)` index cut
 * the table down to a handful of rows, and the exact test then trims the corners of the
 * rectangle that fall outside the circle. The box is deliberately generous — it must never
 * exclude a point that is genuinely in range, since the exact test cannot add rows back.
 */
const getBoundingBox = (
    latitude: number,
    longitude: number,
    radiusMeters: number,
): IBoundingBox => {
    const radius = Math.max(radiusMeters, 0);
    const latitudeDelta = radius / METERS_PER_DEGREE_LATITUDE;
    const latitudeCosine = Math.max(Math.abs(Math.cos((latitude * Math.PI) / 180)), MIN_LATITUDE_COSINE);
    const longitudeDelta = radius / (METERS_PER_DEGREE_LATITUDE * latitudeCosine);

    const minLongitude = longitude - longitudeDelta;
    const maxLongitude = longitude + longitudeDelta;

    return {
        // Clamped rather than wrapped: a box crossing a pole covers every longitude, and
        // latitudes beyond ±90 do not exist to be matched.
        minLatitude: Math.max(latitude - latitudeDelta, -90),
        maxLatitude: Math.min(latitude + latitudeDelta, 90),
        minLongitude,
        maxLongitude,
        wrapsAntimeridian: minLongitude < -180 || maxLongitude > 180,
    };
};

export default getBoundingBox;
