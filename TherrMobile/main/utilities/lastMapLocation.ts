import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local cache of the last map location.
 *
 * Neither the `location` nor the `map` redux slice is in basePersistConfig.whitelist
 * (therr-react/src/redux/persistConfig.ts), so both are empty on every cold start. The
 * only durable location has been `user.details.lastKnownLatitude/Longitude`, which is a
 * server-round-tripped field — absent for a logged-out user and for a fresh install. That
 * is why the map has been opening on a country-wide view centered over Kansas.
 *
 * Widening the redux persist whitelist would have been the other option, but that config
 * lives in therr-public-library and can only ship from `general`. This keeps the fix in
 * the mobile package.
 */
const LAST_MAP_LOCATION_KEY = 'therrLastMapLocation';

// Beyond this the cached point is more likely to mislead than help.
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// Writing on every coordinate update would hammer AsyncStorage — TherrMapView's
// onUserLocationChange fires continuously while the map is open.
const MIN_WRITE_INTERVAL_MS = 1000 * 60 * 5;

export interface ILastMapLocation {
    latitude: number;
    longitude: number;
    updatedAt: number;
}

let lastWriteAt = 0;

export const setLastMapLocation = (latitude?: number, longitude?: number): Promise<void> => {
    if (!latitude || !longitude) {
        return Promise.resolve();
    }

    const now = Date.now();
    if (now - lastWriteAt < MIN_WRITE_INTERVAL_MS) {
        return Promise.resolve();
    }
    lastWriteAt = now;

    const payload: ILastMapLocation = { latitude, longitude, updatedAt: now };

    // Best effort: a failed cache write should never surface to the user or block the map.
    return AsyncStorage.setItem(LAST_MAP_LOCATION_KEY, JSON.stringify(payload))
        .catch(() => undefined);
};

export const getLastMapLocation = (): Promise<ILastMapLocation | undefined> => AsyncStorage
    .getItem(LAST_MAP_LOCATION_KEY)
    .then((raw) => {
        if (!raw) {
            return undefined;
        }

        const parsed = JSON.parse(raw);
        if (!parsed?.latitude || !parsed?.longitude) {
            return undefined;
        }
        if (!parsed.updatedAt || Date.now() - parsed.updatedAt > MAX_AGE_MS) {
            return undefined;
        }

        return parsed as ILastMapLocation;
    })
    .catch(() => undefined);
