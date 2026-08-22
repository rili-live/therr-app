const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points, in metres.
 *
 * Haversine rather than a flat-earth approximation: the callers compare points that can be
 * hundreds of kilometres apart, where a planar approximation drifts badly, and the maths is
 * cheap either way. This is the JS counterpart to the `ST_Distance(...::geography)` the
 * read path uses in SQL — same question, asked where there is no database.
 *
 * Returns NaN for non-finite input rather than a plausible-looking number, so a caller
 * comparing against a threshold fails the comparison instead of silently passing it.
 */
const getDistanceInMeters = (
    latitudeA: number,
    longitudeA: number,
    latitudeB: number,
    longitudeB: number,
): number => {
    if (![latitudeA, longitudeA, latitudeB, longitudeB].every((value) => Number.isFinite(value))) {
        return Number.NaN;
    }

    const deltaLatitude = toRadians(latitudeB - latitudeA);
    const deltaLongitude = toRadians(longitudeB - longitudeA);
    const a = Math.sin(deltaLatitude / 2) ** 2
        + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
};

export default getDistanceInMeters;
