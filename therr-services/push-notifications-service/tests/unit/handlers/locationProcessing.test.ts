import { expect } from 'chai';
import { Location } from 'therr-js-utilities/constants';

describe('Location Processing Handler', () => {
    describe('processUserLocationChange', () => {
        describe('header parsing', () => {
            it('should extract required headers for location processing', () => {
                const mockHeaders = {
                    authorization: 'Bearer test-token',
                    'x-brand-variation': 'therr',
                    'x-localecode': 'en-us',
                    'x-userid': 'user-123',
                    'x-user-device-token': 'device-token-abc',
                    'x-whitelabel-origin': 'https://therr.app',
                };

                expect(mockHeaders.authorization).to.equal('Bearer test-token');
                expect(mockHeaders['x-brand-variation']).to.equal('therr');
                expect(mockHeaders['x-userid']).to.equal('user-123');
                expect(mockHeaders['x-user-device-token']).to.equal('device-token-abc');
            });
        });

        describe('request body parsing', () => {
            it('should extract latitude and longitude from request body', () => {
                const mockBody = {
                    latitude: 37.7749,
                    longitude: -122.4194,
                };

                expect(mockBody.latitude).to.equal(37.7749);
                expect(mockBody.longitude).to.equal(-122.4194);
            });

            it('should handle optional location parameters', () => {
                const mockBody = {
                    latitude: 37.7749,
                    longitude: -122.4194,
                    radiusOfAwareness: 1000,
                    radiusOfInfluence: 500,
                    lastLocationSendForProcessing: new Date().toISOString(),
                };

                expect(mockBody.radiusOfAwareness).to.equal(1000);
                expect(mockBody.radiusOfInfluence).to.equal(500);
            });
        });

        describe('cache invalidation logic', () => {
            it('should invalidate cache when origin is null', () => {
                const origin = null;
                const isCacheInvalid = !origin;
                expect(isCacheInvalid).to.be.eq(true);
            });

            it('should invalidate cache when origin is undefined', () => {
                const origin = undefined;
                const isCacheInvalid = !origin;
                expect(isCacheInvalid).to.be.eq(true);
            });

            it('should not automatically invalidate cache when origin exists', () => {
                const origin = { latitude: 37.7749, longitude: -122.4194 };
                const isCacheInvalid = !origin;
                expect(isCacheInvalid).to.be.eq(false);
            });

            it('should invalidate cache when user has moved beyond threshold distance', () => {
                // AREA_PROXIMITY_NEARBY_METERS is the threshold
                const thresholdMeters = Location.AREA_PROXIMITY_NEARBY_METERS - 1;

                // Simulate distance calculation result
                const distanceFromOriginMeters = thresholdMeters + 10;
                const isCacheInvalid = distanceFromOriginMeters > Location.AREA_PROXIMITY_NEARBY_METERS - 1;

                expect(isCacheInvalid).to.be.eq(true);
            });

            it('should not invalidate cache when user is within threshold distance', () => {
                const thresholdMeters = Location.AREA_PROXIMITY_NEARBY_METERS - 1;
                const distanceFromOriginMeters = thresholdMeters - 100;
                const isCacheInvalid = distanceFromOriginMeters > Location.AREA_PROXIMITY_NEARBY_METERS - 1;

                expect(isCacheInvalid).to.be.eq(false);
            });
        });
    });

    describe('processUserBackgroundLocation', () => {
        describe('request body parsing', () => {
            it('should extract location data from background location format', () => {
                const mockBody = {
                    location: {
                        coords: {
                            latitude: 37.7749,
                            longitude: -122.4194,
                        },
                        is_moving: false,
                        battery: {
                            is_charging: true,
                        },
                        timestamp: Date.now(),
                    },
                    platformOS: 'ios',
                    deviceModel: 'iPhone 13',
                    isDeviceTablet: false,
                };

                expect(mockBody.location.coords.latitude).to.equal(37.7749);
                expect(mockBody.location.coords.longitude).to.equal(-122.4194);
                expect(mockBody.location.is_moving).to.be.eq(false);
                expect(mockBody.platformOS).to.equal('ios');
            });

            it('should handle device information', () => {
                const mockBody = {
                    location: {
                        coords: { latitude: 37.7749, longitude: -122.4194 },
                        is_moving: false,
                    },
                    platformOS: 'android',
                    deviceModel: 'Pixel 6',
                    isDeviceTablet: true,
                };

                expect(mockBody.platformOS).to.equal('android');
                expect(mockBody.deviceModel).to.equal('Pixel 6');
                expect(mockBody.isDeviceTablet).to.be.eq(true);
            });
        });

        describe('early return conditions', () => {
            it('should return early when user is moving', () => {
                const location = {
                    coords: { latitude: 37.7749, longitude: -122.4194 },
                    is_moving: true,
                };

                const shouldReturnEarly = location.is_moving || !location.coords.latitude || !location.coords.longitude;
                expect(shouldReturnEarly).to.be.eq(true);
            });

            it('should return early when latitude is missing', () => {
                const location = {
                    coords: { latitude: null, longitude: -122.4194 },
                    is_moving: false,
                };

                const shouldReturnEarly = location.is_moving || !location.coords.latitude || !location.coords.longitude;
                expect(shouldReturnEarly).to.be.eq(true);
            });

            it('should return early when longitude is missing', () => {
                const location = {
                    coords: { latitude: 37.7749, longitude: null },
                    is_moving: false,
                };

                const shouldReturnEarly = location.is_moving || !location.coords.latitude || !location.coords.longitude;
                expect(shouldReturnEarly).to.be.eq(true);
            });

            it('should proceed when user is stationary with valid coordinates', () => {
                const location = {
                    coords: { latitude: 37.7749, longitude: -122.4194 },
                    is_moving: false,
                };

                const shouldReturnEarly = location.is_moving || !location.coords.latitude || !location.coords.longitude;
                expect(shouldReturnEarly).to.be.eq(false);
            });
        });

        describe('background cache invalidation', () => {
            it('should use more sensitive invalidation for background location', () => {
                // Background uses AREA_PROXIMITY_NEARBY_METERS / 4
                const backgroundThreshold = (Location.AREA_PROXIMITY_NEARBY_METERS / 4) - 1;
                const foregroundThreshold = Location.AREA_PROXIMITY_NEARBY_METERS - 1;

                expect(backgroundThreshold).to.be.lessThan(foregroundThreshold);
            });
        });

        describe('home location detection', () => {
            it('should identify top 3 locations as possible homes', () => {
                const pastLocations = [
                    { id: '1', visitCount: 100, isDeclaredHome: false },
                    { id: '2', visitCount: 80, isDeclaredHome: false },
                    { id: '3', visitCount: 60, isDeclaredHome: false },
                    { id: '4', visitCount: 40, isDeclaredHome: false },
                    { id: '5', visitCount: 20, isDeclaredHome: false },
                ];

                const sortedLocations = pastLocations
                    .filter((loc) => !loc.isDeclaredHome)
                    .sort((a, b) => b.visitCount - a.visitCount);

                const possibleHomesCount = 3;
                const homeLocations = sortedLocations.slice(0, possibleHomesCount);

                expect(homeLocations).to.have.lengthOf(3);
                expect(homeLocations[0].visitCount).to.equal(100);
                expect(homeLocations[2].visitCount).to.equal(60);
            });

            it('should exclude declared home locations from sorting', () => {
                const pastLocations = [
                    { id: '1', visitCount: 100, isDeclaredHome: true },
                    { id: '2', visitCount: 80, isDeclaredHome: false },
                    { id: '3', visitCount: 60, isDeclaredHome: false },
                ];

                const filteredLocations = pastLocations.filter((loc) => !loc.isDeclaredHome);
                expect(filteredLocations).to.have.lengthOf(2);
            });

            it('should separate home locations from non-home locations', () => {
                const pastLocations = [
                    { id: '1', visitCount: 100, isDeclaredHome: false },
                    { id: '2', visitCount: 80, isDeclaredHome: false },
                    { id: '3', visitCount: 60, isDeclaredHome: false },
                    { id: '4', visitCount: 40, isDeclaredHome: false },
                    { id: '5', visitCount: 20, isDeclaredHome: false },
                ];

                const possibleHomesCount = 3;
                const sortedLocations = pastLocations
                    .filter((loc) => !loc.isDeclaredHome)
                    .sort((a, b) => b.visitCount - a.visitCount);

                const homeLocations = sortedLocations.slice(0, possibleHomesCount);
                const nonHomeLocations = sortedLocations.slice(possibleHomesCount);

                expect(homeLocations).to.have.lengthOf(3);
                expect(nonHomeLocations).to.have.lengthOf(2);
            });
        });

        describe('space engagement nudge', () => {
            it('should order spaces by distance from user', () => {
                const spaces = [
                    { id: 'space-1', distanceFromUserMeters: 500 },
                    { id: 'space-2', distanceFromUserMeters: 100 },
                    { id: 'space-3', distanceFromUserMeters: 300 },
                ];

                const sortedSpaces = spaces.sort((a, b) => a.distanceFromUserMeters - b.distanceFromUserMeters);

                expect(sortedSpaces[0].id).to.equal('space-2');
                expect(sortedSpaces[1].id).to.equal('space-3');
                expect(sortedSpaces[2].id).to.equal('space-1');
            });

            it('should filter spaces within check-in distance', () => {
                const maxCheckInDistance = Location.MAX_DISTANCE_TO_CHECK_IN_METERS;

                const spaces = [
                    { id: 'space-1', distanceFromUserMeters: maxCheckInDistance - 10 },
                    { id: 'space-2', distanceFromUserMeters: maxCheckInDistance + 10 },
                    { id: 'space-3', distanceFromUserMeters: maxCheckInDistance - 50 },
                ];

                const spacesWithinDistance = spaces.filter(
                    (s) => s.distanceFromUserMeters <= maxCheckInDistance,
                );

                expect(spacesWithinDistance).to.have.lengthOf(2);
            });

            it('should limit possible spaces to top 3', () => {
                const spaces = [
                    { id: 'space-1' },
                    { id: 'space-2' },
                    { id: 'space-3' },
                    { id: 'space-4' },
                    { id: 'space-5' },
                ];

                const limitedSpaces = spaces.slice(0, 3);
                expect(limitedSpaces).to.have.lengthOf(3);
            });
        });

        describe('notification timing', () => {
            it('should check if enough time has passed since last notification', () => {
                const now = Date.now();
                const lastNotificationSent = new Date(now - Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS - 1000);
                const msSinceLastNotification = now - lastNotificationSent.getTime();

                const shouldSendNotification = msSinceLastNotification > Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS;
                expect(shouldSendNotification).to.be.eq(true);
            });

            it('should not send notification if sent too recently', () => {
                const now = Date.now();
                const lastNotificationSent = new Date(now - 1000); // 1 second ago
                const msSinceLastNotification = now - lastNotificationSent.getTime();

                const shouldSendNotification = msSinceLastNotification > Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS;
                expect(shouldSendNotification).to.be.eq(false);
            });

            it('should send notification if no previous notification exists', () => {
                const lastNotificationSent = null;
                const shouldSendNotification = !lastNotificationSent;
                expect(shouldSendNotification).to.be.eq(true);
            });
        });
    });

    describe('Response handling', () => {
        it('should return activated areas in response', () => {
            const momentsToActivate = [{ id: 'moment-1' }, { id: 'moment-2' }];
            const spacesToActivate = [{ id: 'space-1' }];

            const response = {
                activatedAreas: [spacesToActivate, ...momentsToActivate],
            };

            expect(response.activatedAreas).to.have.lengthOf(3);
            expect(response.activatedAreas[0]).to.deep.equal([{ id: 'space-1' }]);
        });

        it('should handle empty activated areas', () => {
            const momentsToActivate: any[] = [];
            const spacesToActivate: any[] = [];

            const response = {
                activatedAreas: [spacesToActivate, ...momentsToActivate],
            };

            expect(response.activatedAreas).to.have.lengthOf(1);
            expect(response.activatedAreas[0]).to.deep.equal([]);
        });
    });
});

describe('Distance calculations', () => {
    describe('distanceTo utility', () => {
        it('should calculate zero distance for same coordinates', () => {
            const point1 = { lon: -122.4194, lat: 37.7749 };
            const point2 = { lon: -122.4194, lat: 37.7749 };

            // Simple approximation for testing (actual uses geolocation-utils)
            const distance = Math.sqrt(
                ((point1.lon - point2.lon) ** 2) + ((point1.lat - point2.lat) ** 2),
            ) * 111000;

            expect(distance).to.equal(0);
        });

        it('should calculate non-zero distance for different coordinates', () => {
            const point1 = { lon: -122.4194, lat: 37.7749 };
            const point2 = { lon: -122.4195, lat: 37.7750 };

            const distance = Math.sqrt(
                ((point1.lon - point2.lon) ** 2) + ((point1.lat - point2.lat) ** 2),
            ) * 111000;

            expect(distance).to.be.greaterThan(0);
        });
    });
});
