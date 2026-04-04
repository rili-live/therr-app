/**
 * Estimate a search radius in meters from a Nominatim bounding box.
 * The bounding box is [south, north, west, east] in decimal degrees.
 * We compute the diagonal distance using the Haversine formula and return half of it as the radius.
 */
const EARTH_RADIUS_METERS = 6371000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

export const estimateRadiusFromBounds = (boundingBox: number[]): number => {
    if (!boundingBox || boundingBox.length < 4) {
        return 200000; // 200km default
    }

    const [south, north, west, east] = boundingBox;
    const lat1 = toRadians(south);
    const lat2 = toRadians(north);
    const dLat = lat2 - lat1;
    const dLon = toRadians(east - west);

    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const diagonal = EARTH_RADIUS_METERS * c;

    // Use half the diagonal as the radius, with a minimum of 10km and max of 2000km
    return Math.max(10000, Math.min(diagonal / 2, 2000000));
};
