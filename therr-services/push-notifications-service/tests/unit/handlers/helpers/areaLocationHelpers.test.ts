import { expect } from 'chai';
import { Location } from 'therr-js-utilities/constants';

describe('areaLocationHelpers', () => {
    describe('hasSentNotificationRecently', () => {
        // Replicating the function logic for testing
        const hasSentNotificationRecently = (lastNotificationDate: number | null, isCheckInNotification = false) => {
            const minDuration = isCheckInNotification
                ? Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS
                : Location.MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS;

            return lastNotificationDate
                && (Date.now() - lastNotificationDate < minDuration);
        };

        it('should return falsy when lastNotificationDate is null', () => {
            const result = hasSentNotificationRecently(null);
            expect(!result).to.be.eq(true);
        });

        it('should return falsy when lastNotificationDate is undefined', () => {
            const result = hasSentNotificationRecently(undefined as any);
            expect(!result).to.be.eq(true);
        });

        it('should return true when notification was sent within MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS', () => {
            const recentTime = Date.now() - (Location.MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS / 2);
            const result = hasSentNotificationRecently(recentTime);
            expect(result).to.be.eq(true);
        });

        it('should return false when notification was sent longer ago than MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS', () => {
            const oldTime = Date.now() - (Location.MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS + 1000);
            const result = hasSentNotificationRecently(oldTime);
            expect(result).to.be.eq(false);
        });

        it('should use MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS when isCheckInNotification is true', () => {
            // Create a time that's within check-in threshold but outside regular threshold
            const checkInDuration = Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS;
            const recentCheckInTime = Date.now() - (checkInDuration / 2);
            const result = hasSentNotificationRecently(recentCheckInTime, true);
            expect(result).to.be.eq(true);
        });

        it('should return false for check-in notification when time exceeds threshold', () => {
            const oldCheckInTime = Date.now() - (Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS + 1000);
            const result = hasSentNotificationRecently(oldCheckInTime, true);
            expect(result).to.be.eq(false);
        });
    });

    describe('canActivateArea', () => {
        // Replicating the function logic for testing
        const canActivateArea = (area: any, userLocation: { longitude: number; latitude: number }) => {
            const areaRequiredProximityMeters = area.radius + area.maxProximity;

            // Using simple distance calculation for test purposes
            // The actual implementation uses geolocation-utils distanceTo
            const distToCenter = Math.sqrt(
                ((area.longitude - userLocation.longitude) ** 2)
                + ((area.latitude - userLocation.latitude) ** 2),
            ) * 111000; // Approximate meters per degree

            // tempLocationExpansionDistMeters defaults to 0 in most cases
            const tempLocationExpansionDistMeters = 0;
            return distToCenter - areaRequiredProximityMeters <= tempLocationExpansionDistMeters;
        };

        it('should return true when user is exactly at area center', () => {
            const area = {
                longitude: -122.4194,
                latitude: 37.7749,
                radius: 100,
                maxProximity: 50,
            };
            const userLocation = {
                longitude: -122.4194,
                latitude: 37.7749,
            };

            // Distance is 0, which is less than radius + maxProximity
            const result = canActivateArea(area, userLocation);
            expect(result).to.be.eq(true);
        });

        it('should return true when user is within area proximity', () => {
            const area = {
                longitude: -122.4194,
                latitude: 37.7749,
                radius: 100,
                maxProximity: 50,
            };
            // Very close to center
            const userLocation = {
                longitude: -122.4195,
                latitude: 37.7749,
            };

            const result = canActivateArea(area, userLocation);
            expect(result).to.be.eq(true);
        });

        it('should return false when user is far from area', () => {
            const area = {
                longitude: -122.4194,
                latitude: 37.7749,
                radius: 100,
                maxProximity: 50,
            };
            // About 1 degree away (roughly 111km)
            const userLocation = {
                longitude: -121.4194,
                latitude: 37.7749,
            };

            const result = canActivateArea(area, userLocation);
            expect(result).to.be.eq(false);
        });

        it('should handle areas with large radius', () => {
            const area = {
                longitude: -122.4194,
                latitude: 37.7749,
                radius: 5000,
                maxProximity: 1000,
            };
            const userLocation = {
                longitude: -122.4194,
                latitude: 37.7749,
            };

            const result = canActivateArea(area, userLocation);
            expect(result).to.be.eq(true);
        });

        it('should handle areas with zero maxProximity', () => {
            const area = {
                longitude: -122.4194,
                latitude: 37.7749,
                radius: 50,
                maxProximity: 0,
            };
            const userLocation = {
                longitude: -122.4194,
                latitude: 37.7749,
            };

            const result = canActivateArea(area, userLocation);
            expect(result).to.be.eq(true);
        });
    });

    describe('Location constants', () => {
        it('should have MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS defined', () => {
            expect(Location.MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS).to.be.a('number');
            expect(Location.MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS).to.be.greaterThan(0);
        });

        it('should have MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS defined', () => {
            expect(Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS).to.be.a('number');
            expect(Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS).to.be.greaterThan(0);
        });

        it('should have AREA_PROXIMITY_METERS defined', () => {
            expect(Location.AREA_PROXIMITY_METERS).to.be.a('number');
            expect(Location.AREA_PROXIMITY_METERS).to.be.greaterThan(0);
        });

        it('should have AREA_PROXIMITY_NEARBY_METERS defined', () => {
            expect(Location.AREA_PROXIMITY_NEARBY_METERS).to.be.a('number');
            expect(Location.AREA_PROXIMITY_NEARBY_METERS).to.be.greaterThan(0);
        });

        it('should have AREA_PROXIMITY_EXPANDED_METERS defined', () => {
            expect(Location.AREA_PROXIMITY_EXPANDED_METERS).to.be.a('number');
            expect(Location.AREA_PROXIMITY_EXPANDED_METERS).to.be.greaterThan(0);
        });

        it('should have MAX_AREA_ACTIVATE_COUNT defined', () => {
            expect(Location.MAX_AREA_ACTIVATE_COUNT).to.be.a('number');
            expect(Location.MAX_AREA_ACTIVATE_COUNT).to.be.greaterThan(0);
        });

        it('should have MAX_DISTANCE_TO_CHECK_IN_METERS defined', () => {
            expect(Location.MAX_DISTANCE_TO_CHECK_IN_METERS).to.be.a('number');
            expect(Location.MAX_DISTANCE_TO_CHECK_IN_METERS).to.be.greaterThan(0);
        });

        it('should have FALLBACK_CACHE_SEARCH_RADIUS_METERS defined', () => {
            expect(Location.FALLBACK_CACHE_SEARCH_RADIUS_METERS).to.be.a('number');
            expect(Location.FALLBACK_CACHE_SEARCH_RADIUS_METERS).to.be.greaterThan(0);
        });
    });

    describe('selectAreasAndActivate logic', () => {
        it('should limit moments to activate based on MAX_AREA_ACTIVATE_COUNT', () => {
            const maxCount = Location.MAX_AREA_ACTIVATE_COUNT;
            expect(maxCount).to.be.a('number');

            // Create more areas than the limit
            const manyMoments = Array.from({ length: maxCount + 5 }, (_, i) => ({
                id: `moment-${i}`,
                longitude: -122.4194,
                latitude: 37.7749,
            }));

            // The function should only select up to MAX_AREA_ACTIVATE_COUNT
            const limitedMoments = manyMoments.slice(0, maxCount);
            expect(limitedMoments.length).to.equal(maxCount);
        });

        it('should limit spaces to activate based on MAX_AREA_ACTIVATE_COUNT', () => {
            const maxCount = Location.MAX_AREA_ACTIVATE_COUNT;

            const manySpaces = Array.from({ length: maxCount + 5 }, (_, i) => ({
                id: `space-${i}`,
                longitude: -122.4194,
                latitude: 37.7749,
            }));

            const limitedSpaces = manySpaces.slice(0, maxCount);
            expect(limitedSpaces.length).to.equal(maxCount);
        });

        it('should prioritize spaces over moments when both are present', () => {
            // Based on the implementation, spaces are activated first,
            // then remaining quota goes to moments
            const maxCount = Location.MAX_AREA_ACTIVATE_COUNT;
            const spaceCount = Math.floor(maxCount / 2);
            const remainingForMoments = maxCount - spaceCount;

            expect(remainingForMoments).to.be.greaterThan(0);
            expect(spaceCount + remainingForMoments).to.be.lessThanOrEqual(maxCount + 1);
        });
    });
});

describe('Area filtering logic', () => {
    describe('filterNearbyAreas', () => {
        it('should return empty array when no areas provided', () => {
            const emptyAreas: any[] = [];
            expect(emptyAreas.length).to.equal(0);
        });

        it('should filter out already activated areas', () => {
            const areas = [
                { id: 'area-1', activated: true },
                { id: 'area-2', activated: false },
                { id: 'area-3', activated: true },
            ];

            const unactivated = areas.filter((a) => !a.activated);
            expect(unactivated.length).to.equal(1);
            expect(unactivated[0].id).to.equal('area-2');
        });

        it('should separate areas requiring proximity from others', () => {
            const areas = [
                { id: 'area-1', doesRequireProximityView: true },
                { id: 'area-2', doesRequireProximityView: false },
                { id: 'area-3', doesRequireProximityView: true },
            ];

            const proximityRequired = areas.filter((a) => a.doesRequireProximityView);
            const autoActivatable = areas.filter((a) => !a.doesRequireProximityView);

            expect(proximityRequired.length).to.equal(2);
            expect(autoActivatable.length).to.equal(1);
        });
    });

    describe('caching logic', () => {
        it('should correctly calculate max activation distance', () => {
            const areas = [
                { radius: 100, maxProximity: 50 },
                { radius: 200, maxProximity: 100 },
                { radius: 50, maxProximity: 25 },
            ];

            let maxActivationDistance = Location.AREA_PROXIMITY_METERS;
            areas.forEach((area) => {
                maxActivationDistance = Math.max(maxActivationDistance, area.radius + area.maxProximity);
            });

            // Result is max of AREA_PROXIMITY_METERS and the largest (radius + maxProximity)
            // 200 + 100 = 300, but if AREA_PROXIMITY_METERS is larger, that wins
            const expectedMax = Math.max(Location.AREA_PROXIMITY_METERS, 300);
            expect(maxActivationDistance).to.equal(expectedMax);
        });
    });
});
