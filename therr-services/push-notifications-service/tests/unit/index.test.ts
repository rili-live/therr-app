import { expect } from 'chai';
import { PushNotifications, Location, BrandVariations } from 'therr-js-utilities/constants';

describe('Push Notifications Service - Unit Tests', () => {
    it('unit test suite should be properly configured', () => {
        expect(true).to.be.equal(true);
    });

    it('should have access to therr-js-utilities constants', () => {
        // Verify core dependencies are accessible
        expect(PushNotifications).to.not.be.eq(undefined);
        expect(PushNotifications.Types).to.not.be.eq(undefined);
        expect(Location).to.not.be.eq(undefined);
        expect(BrandVariations).to.not.be.eq(undefined);
    });

    it('should have required notification types', () => {
        // Core notification types that the service depends on
        const requiredTypes = [
            'newDirectMessage',
            'newGroupMessage',
            'newConnectionRequest',
            'connectionRequestAccepted',
            'achievementCompleted',
            'newLikeReceived',
            'newAreasActivated',
            'nudgeSpaceEngagement',
        ];

        requiredTypes.forEach((type) => {
            expect(PushNotifications.Types[type]).to.be.a('string');
        });
    });

    it('should have required location constants', () => {
        // Core location constants that the service depends on
        const requiredConstants = [
            'AREA_PROXIMITY_METERS',
            'AREA_PROXIMITY_NEARBY_METERS',
            'AREA_PROXIMITY_EXPANDED_METERS',
            'MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS',
            'MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS',
            'MAX_AREA_ACTIVATE_COUNT',
            'MAX_DISTANCE_TO_CHECK_IN_METERS',
        ];

        requiredConstants.forEach((constant) => {
            expect(Location[constant]).to.be.a('number');
        });
    });
});
