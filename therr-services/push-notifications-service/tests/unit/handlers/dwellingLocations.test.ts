import { expect } from 'chai';
import { Location } from 'therr-js-utilities/constants';
import {
    findCurrentDwellingLocation,
    isAtDwellingLocation,
    isDwellingLocation,
} from '../../../src/handlers/helpers/dwellingLocations';

const NOW = new Date('2026-07-28T12:00:00.000Z').getTime();
const DAY_MS = 1000 * 60 * 60 * 24;

// Golden Gate Park area
const HOME = {
    latitude: 37.7749,
    longitude: -122.4194,
};

// ~1.3km east of HOME
const AWAY = {
    latitude: 37.7749,
    longitude: -122.4044,
};

const buildLocation = (overrides: any = {}) => ({
    id: 'location-1',
    latitude: HOME.latitude,
    longitude: HOME.longitude,
    isDeclaredHome: false,
    distinctDayCount: Location.DWELL_MIN_DISTINCT_DAYS,
    lastVisitedAt: new Date(NOW - DAY_MS).toISOString(),
    ...overrides,
});

describe('dwellingLocations', () => {
    describe('isDwellingLocation', () => {
        it('should qualify a location observed on enough distinct days', () => {
            expect(isDwellingLocation(buildLocation(), NOW)).to.be.eq(true);
        });

        it('should not qualify a location observed on too few distinct days', () => {
            const location = buildLocation({ distinctDayCount: Location.DWELL_MIN_DISTINCT_DAYS - 1 });

            expect(isDwellingLocation(location, NOW)).to.be.eq(false);
        });

        it('should not qualify a frequently visited location seen on a single day', () => {
            // A coffee shop can accumulate a high visitCount from background pings in one sitting
            const location = buildLocation({ distinctDayCount: 1, visitCount: 250 });

            expect(isDwellingLocation(location, NOW)).to.be.eq(false);
        });

        it('should always qualify a user-declared home', () => {
            const location = buildLocation({
                isDeclaredHome: true,
                distinctDayCount: 1,
                lastVisitedAt: new Date(NOW - (DAY_MS * 365)).toISOString(),
            });

            expect(isDwellingLocation(location, NOW)).to.be.eq(true);
        });

        it('should let a stale dwelling (e.g. last year\'s hotel) decay out', () => {
            const location = buildLocation({
                distinctDayCount: 10,
                lastVisitedAt: new Date(NOW - Location.DWELL_LOCATION_MAX_AGE_MS - DAY_MS).toISOString(),
            });

            expect(isDwellingLocation(location, NOW)).to.be.eq(false);
        });

        it('should keep a recent temporary living space qualified', () => {
            // 4-night hotel stay that ended a week ago
            const location = buildLocation({
                distinctDayCount: 4,
                lastVisitedAt: new Date(NOW - (DAY_MS * 7)).toISOString(),
            });

            expect(isDwellingLocation(location, NOW)).to.be.eq(true);
        });

        it('should handle string column values from postgres', () => {
            const location = buildLocation({
                distinctDayCount: `${Location.DWELL_MIN_DISTINCT_DAYS}`,
                lastVisitedAt: new Date(NOW - DAY_MS),
            });

            expect(isDwellingLocation(location, NOW)).to.be.eq(true);
        });

        it('should not qualify a location with a missing or unparseable lastVisitedAt', () => {
            expect(isDwellingLocation(buildLocation({ lastVisitedAt: null }), NOW)).to.be.eq(false);
            expect(isDwellingLocation(buildLocation({ lastVisitedAt: 'not-a-date' }), NOW)).to.be.eq(false);
        });

        it('should not throw on a missing location', () => {
            expect(isDwellingLocation(undefined as any, NOW)).to.be.eq(false);
        });
    });

    describe('findCurrentDwellingLocation', () => {
        it('should match a dwelling the user is standing at', () => {
            const match = findCurrentDwellingLocation([buildLocation()], HOME, NOW);

            expect(match?.id).to.equal('location-1');
        });

        it('should match through GPS drift within the dwelling radius', () => {
            // ~0.0005 degrees latitude is ~55m — inside DWELL_LOCATION_RADIUS_METERS but
            // far enough to land in a different rounded coordinate cell
            const drifted = {
                latitude: HOME.latitude + 0.0005,
                longitude: HOME.longitude,
            };

            expect(isAtDwellingLocation([buildLocation()], drifted, NOW)).to.be.eq(true);
        });

        it('should not match when the user is away from every dwelling', () => {
            expect(findCurrentDwellingLocation([buildLocation()], AWAY, NOW)).to.be.eq(undefined);
        });

        it('should not match a nearby location that is not yet a dwelling', () => {
            const notADwelling = buildLocation({ distinctDayCount: 1 });

            expect(findCurrentDwellingLocation([notADwelling], HOME, NOW)).to.be.eq(undefined);
        });

        it('should return undefined for an empty or missing dwelling list', () => {
            expect(findCurrentDwellingLocation([], HOME, NOW)).to.be.eq(undefined);
            expect(findCurrentDwellingLocation(undefined, HOME, NOW)).to.be.eq(undefined);
        });

        it('should ignore rows with unusable coordinates', () => {
            const broken = buildLocation({ latitude: null, longitude: null });

            expect(findCurrentDwellingLocation([broken], HOME, NOW)).to.be.eq(undefined);
        });

        it('should return undefined when the user location is invalid', () => {
            const invalid = { latitude: NaN, longitude: NaN };

            expect(findCurrentDwellingLocation([buildLocation()], invalid, NOW)).to.be.eq(undefined);
        });
    });

    describe('isAtDwellingLocation', () => {
        it('should suppress at home and allow while out', () => {
            const dwellings = [buildLocation()];

            expect(isAtDwellingLocation(dwellings, HOME, NOW)).to.be.eq(true);
            expect(isAtDwellingLocation(dwellings, AWAY, NOW)).to.be.eq(false);
        });

        it('should pick whichever dwelling the user is currently at', () => {
            const hotel = buildLocation({
                id: 'hotel',
                latitude: AWAY.latitude,
                longitude: AWAY.longitude,
                distinctDayCount: 3,
            });

            expect(isAtDwellingLocation([buildLocation(), hotel], AWAY, NOW)).to.be.eq(true);
        });
    });
});
