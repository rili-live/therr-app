/**
 * @jest-environment jsdom
 */
import { estimateRadiusFromBounds } from '../geocode';

describe('estimateRadiusFromBounds', () => {
    it('returns 200km default when boundingBox is null', () => {
        expect(estimateRadiusFromBounds(null as any)).toBe(200000);
    });

    it('returns 200km default when boundingBox is undefined', () => {
        expect(estimateRadiusFromBounds(undefined as any)).toBe(200000);
    });

    it('returns 200km default when boundingBox is empty', () => {
        expect(estimateRadiusFromBounds([])).toBe(200000);
    });

    it('returns 200km default when boundingBox has fewer than 4 elements', () => {
        expect(estimateRadiusFromBounds([40, 41, -85])).toBe(200000);
    });

    it('computes a reasonable radius for a US state (Michigan)', () => {
        // Michigan bounding box: [41.696, 48.306, -90.418, -82.122]
        const michiganBbox = [41.696, 48.306, -90.418, -82.122];
        const radius = estimateRadiusFromBounds(michiganBbox);
        // Michigan is roughly 400km x 600km, so half-diagonal should be ~250-400km
        expect(radius).toBeGreaterThan(200000);
        expect(radius).toBeLessThan(500000);
    });

    it('computes a reasonable radius for a city (New York City)', () => {
        // NYC bounding box: [40.4774, 40.9176, -74.2591, -73.7004]
        const nycBbox = [40.4774, 40.9176, -74.2591, -73.7004];
        const radius = estimateRadiusFromBounds(nycBbox);
        // NYC is roughly 50km x 30km, so half-diagonal should be ~15-40km
        expect(radius).toBeGreaterThan(10000); // minimum is 10km
        expect(radius).toBeLessThan(50000);
    });

    it('enforces minimum radius of 10km for very small bounding boxes', () => {
        // A single point (zero-area bounding box)
        const pointBbox = [40.7128, 40.7128, -74.0060, -74.0060];
        const radius = estimateRadiusFromBounds(pointBbox);
        expect(radius).toBe(10000);
    });

    it('enforces maximum radius of 2000km for very large bounding boxes', () => {
        // Entire globe
        const globeBbox = [-90, 90, -180, 180];
        const radius = estimateRadiusFromBounds(globeBbox);
        expect(radius).toBe(2000000);
    });

    it('handles bounding boxes crossing the prime meridian', () => {
        // London area: [51.28, 51.69, -0.51, 0.33]
        const londonBbox = [51.28, 51.69, -0.51, 0.33];
        const radius = estimateRadiusFromBounds(londonBbox);
        expect(radius).toBeGreaterThan(10000);
        expect(radius).toBeLessThan(100000);
    });
});
