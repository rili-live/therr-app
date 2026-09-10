// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLastMapLocation, setLastMapLocation } from '../../main/utilities/lastMapLocation';

/**
 * Last-map-location cache tests.
 *
 * This is what decides where the map opens on a cold start for a logged-out user or a fresh
 * install. A coordinate this module rejects sends the user back to the country-wide fallback
 * view, so the guards have to reject only genuinely unusable values — `0` is a real latitude
 * and a real longitude.
 */

const LAST_MAP_LOCATION_KEY = 'therrLastMapLocation';
const DAY_MS = 24 * 60 * 60 * 1000;

// setLastMapLocation self-throttles to one write per 5 minutes via module-level state, so
// each write test needs a clock far enough ahead of the previous one to clear it.
let clock = Date.UTC(2026, 7, 24);
const advanceClockPastWriteThrottle = () => {
    clock += 10 * 60 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(clock);
};

describe('lastMapLocation', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        advanceClockPastWriteThrottle();
    });

    it('stores a longitude of exactly 0 rather than discarding it', async () => {
        await setLastMapLocation(51.4779, 0);

        const stored = await AsyncStorage.getItem(LAST_MAP_LOCATION_KEY);
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored as string)).toEqual(
            expect.objectContaining({ latitude: 51.4779, longitude: 0 }),
        );
    });

    it('reads back a cached location on the prime meridian', async () => {
        await setLastMapLocation(51.4779, 0);

        expect(await getLastMapLocation()).toEqual(
            expect.objectContaining({ latitude: 51.4779, longitude: 0 }),
        );
    });

    it('stores a latitude of exactly 0 rather than discarding it', async () => {
        await setLastMapLocation(0, -78.5);

        expect(await getLastMapLocation()).toEqual(
            expect.objectContaining({ latitude: 0, longitude: -78.5 }),
        );
    });

    it.each([
        ['undefined', undefined],
        ['NaN', NaN],
        ['Infinity', Infinity],
    ])('still refuses to store a %s coordinate', async (_label, value) => {
        await setLastMapLocation(value as any, 12);

        expect(await AsyncStorage.getItem(LAST_MAP_LOCATION_KEY)).toBeNull();
    });

    it('ignores a cached entry whose coordinates are not numbers', async () => {
        await AsyncStorage.setItem(LAST_MAP_LOCATION_KEY, JSON.stringify({
            latitude: 'not-a-latitude',
            longitude: 0,
            updatedAt: Date.now(),
        }));

        expect(await getLastMapLocation()).toBeUndefined();
    });

    it('ignores a cached entry older than the max age', async () => {
        await AsyncStorage.setItem(LAST_MAP_LOCATION_KEY, JSON.stringify({
            latitude: 41.8781,
            longitude: -87.6298,
            updatedAt: Date.now() - (31 * DAY_MS),
        }));

        expect(await getLastMapLocation()).toBeUndefined();
    });

    it('ignores a cached entry with no timestamp', async () => {
        await AsyncStorage.setItem(LAST_MAP_LOCATION_KEY, JSON.stringify({
            latitude: 41.8781,
            longitude: -87.6298,
        }));

        expect(await getLastMapLocation()).toBeUndefined();
    });

    it('degrades to undefined on a corrupt cache entry rather than throwing', async () => {
        await AsyncStorage.setItem(LAST_MAP_LOCATION_KEY, '{not json');

        expect(await getLastMapLocation()).toBeUndefined();
    });
});
