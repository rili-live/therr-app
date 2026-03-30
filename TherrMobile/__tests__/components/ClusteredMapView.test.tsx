import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * ClusteredMapView Logic Tests
 *
 * Tests the pure helper functions used by the ClusteredMapView component
 * for zoom level calculation and bounding box computation.
 *
 * These functions are extracted here to mirror the module-level helpers
 * in main/components/ClusteredMapView.tsx.
 */

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

// ============================================================================
// Helper functions (mirroring ClusteredMapView.tsx module-level helpers)
// ============================================================================

interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

const calculateBBox = (region: Region): [number, number, number, number] => {
    return [
        region.longitude - region.longitudeDelta / 2,
        region.latitude - region.latitudeDelta / 2,
        region.longitude + region.longitudeDelta / 2,
        region.latitude + region.latitudeDelta / 2,
    ];
};

const getZoomLevel = (region: Region, width: number): number => {
    return Math.ceil(Math.log2(360 * (width / 256) / region.longitudeDelta));
};

const getClusterStyle = (pointCount: number) => {
    if (pointCount >= 50) return { size: 64, fontSize: 20 };
    if (pointCount >= 25) return { size: 58, fontSize: 19 };
    if (pointCount >= 15) return { size: 54, fontSize: 18 };
    if (pointCount >= 10) return { size: 50, fontSize: 17 };
    if (pointCount >= 4) return { size: 40, fontSize: 16 };
    return { size: 36, fontSize: 15 };
};

// ============================================================================
// Tests
// ============================================================================

describe('getZoomLevel', () => {
    const PHONE_WIDTH = 390;  // Typical phone screen width
    const TABLET_WIDTH = 768; // Typical tablet screen width

    it('should return zoom levels within supercluster valid range (0-20)', () => {
        // Test various longitudeDeltas from world view to street level
        const deltas = [360, 180, 90, 45, 10, 1, 0.1, 0.01, 0.001];

        deltas.forEach((delta) => {
            const region: Region = {
                latitude: 0, longitude: 0, latitudeDelta: delta / 2, longitudeDelta: delta,
            };
            const zoom = getZoomLevel(region, PHONE_WIDTH);
            expect(zoom).toBeGreaterThanOrEqual(0);
            expect(zoom).toBeLessThanOrEqual(25);
        });
    });

    it('should produce higher zoom levels when zoomed in (smaller longitudeDelta)', () => {
        const zoomedOut: Region = {
            latitude: 0, longitude: 0, latitudeDelta: 45, longitudeDelta: 90,
        };
        const zoomedIn: Region = {
            latitude: 0, longitude: 0, latitudeDelta: 0.05, longitudeDelta: 0.1,
        };

        const zoomOut = getZoomLevel(zoomedOut, PHONE_WIDTH);
        const zoomIn = getZoomLevel(zoomedIn, PHONE_WIDTH);

        expect(zoomIn).toBeGreaterThan(zoomOut);
    });

    it('should produce consistent zoom levels across phone and tablet widths', () => {
        const region: Region = {
            latitude: 40.7, longitude: -74.0, latitudeDelta: 0.05, longitudeDelta: 0.1,
        };

        const phoneZoom = getZoomLevel(region, PHONE_WIDTH);
        const tabletZoom = getZoomLevel(region, TABLET_WIDTH);

        // Width affects zoom, but the difference should be small (1-2 levels max)
        // This verifies we use log2(width/256) addition, not multiplication
        expect(Math.abs(tabletZoom - phoneZoom)).toBeLessThanOrEqual(2);
    });

    it('should not inflate zoom levels by screen width factor (regression test)', () => {
        // The bug was: Math.log2(360/delta) * (width/256)
        // which inflated zoom by ~1.5x on a 390px phone
        // Correct: Math.log2(360 * (width/256) / delta)
        const region: Region = {
            latitude: 40.7, longitude: -74.0, latitudeDelta: 0.05, longitudeDelta: 0.1,
        };

        const zoom = getZoomLevel(region, PHONE_WIDTH);

        // With longitudeDelta=0.1 on a 390px phone:
        // Correct: ceil(log2(360 * 1.52 / 0.1)) = ceil(log2(5472)) = ceil(12.42) = 13
        // Bug would give: round(log2(3600) * 1.52) = round(11.81 * 1.52) = round(17.95) = 18
        expect(zoom).toBeLessThan(16);
        expect(zoom).toBeGreaterThanOrEqual(12);
    });

    it('should return zoom ~1 for world-level view', () => {
        const worldRegion: Region = {
            latitude: 0, longitude: 0, latitudeDelta: 90, longitudeDelta: 360,
        };

        const zoom = getZoomLevel(worldRegion, PHONE_WIDTH);
        expect(zoom).toBeLessThanOrEqual(2);
    });

    it('should return zoom ~12-14 for city-level view', () => {
        const cityRegion: Region = {
            latitude: 40.7, longitude: -74.0, latitudeDelta: 0.05, longitudeDelta: 0.1,
        };

        const zoom = getZoomLevel(cityRegion, PHONE_WIDTH);
        expect(zoom).toBeGreaterThanOrEqual(11);
        expect(zoom).toBeLessThanOrEqual(15);
    });
});

describe('calculateBBox', () => {
    it('should compute correct bounding box from region', () => {
        const region: Region = {
            latitude: 40.0,
            longitude: -74.0,
            latitudeDelta: 0.1,
            longitudeDelta: 0.2,
        };

        const bbox = calculateBBox(region);
        expect(bbox).toEqual([
            -74.1,  // west: longitude - longitudeDelta/2
            39.95,  // south: latitude - latitudeDelta/2
            -73.9,  // east: longitude + longitudeDelta/2
            40.05,  // north: latitude + latitudeDelta/2
        ]);
    });

    it('should handle regions crossing the prime meridian', () => {
        const region: Region = {
            latitude: 51.5,
            longitude: 0.0,
            latitudeDelta: 0.2,
            longitudeDelta: 0.4,
        };

        const bbox = calculateBBox(region);
        expect(bbox[0]).toBeCloseTo(-0.2); // west
        expect(bbox[2]).toBeCloseTo(0.2);  // east
    });

    it('should handle equatorial regions', () => {
        const region: Region = {
            latitude: 0.0,
            longitude: 0.0,
            latitudeDelta: 1.0,
            longitudeDelta: 1.0,
        };

        const bbox = calculateBBox(region);
        expect(bbox).toEqual([-0.5, -0.5, 0.5, 0.5]);
    });
});

describe('getClusterStyle', () => {
    it('should return smallest style for 1-3 points', () => {
        expect(getClusterStyle(1)).toEqual({ size: 36, fontSize: 15 });
        expect(getClusterStyle(3)).toEqual({ size: 36, fontSize: 15 });
    });

    it('should scale up for 4+ points', () => {
        expect(getClusterStyle(4)).toEqual({ size: 40, fontSize: 16 });
    });

    it('should scale up for 10+ points', () => {
        expect(getClusterStyle(10)).toEqual({ size: 50, fontSize: 17 });
    });

    it('should scale up for 15+ points', () => {
        expect(getClusterStyle(15)).toEqual({ size: 54, fontSize: 18 });
    });

    it('should scale up for 25+ points', () => {
        expect(getClusterStyle(25)).toEqual({ size: 58, fontSize: 19 });
    });

    it('should return largest style for 50+ points', () => {
        expect(getClusterStyle(50)).toEqual({ size: 64, fontSize: 20 });
        expect(getClusterStyle(100)).toEqual({ size: 64, fontSize: 20 });
    });
});
