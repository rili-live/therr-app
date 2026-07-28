import { distanceTo } from 'geolocation-utils';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { Location } from 'therr-js-utilities/constants';

/**
 * A "dwelling" is a general location where the user lives or is temporarily staying —
 * home, an apartment, a hotel, a rental. It is identified by presence across multiple
 * distinct calendar days rather than by raw visit count, because background location
 * pings increment visit count many times within a single stay.
 *
 * Nearby-search push notifications are suppressed at these locations: the user has
 * already discovered whatever is around where they sleep, so the notifications are
 * pure noise there.
 */
export interface IUserDwellingLocation {
    id?: string;
    latitude: number | string;
    longitude: number | string;
    distinctDayCount?: number | string | null;
    isDeclaredHome?: boolean | null;
    lastVisitedAt?: string | Date | null;
}

export interface IDwellingUserLocation {
    latitude: number;
    longitude: number;
}

const toNumber = (value: any): number => (typeof value === 'number' ? value : Number(value));

/**
 * Whether a stored userLocation currently qualifies as a dwelling.
 *
 * The users-service already applies this filter in SQL; re-applying it here keeps the
 * helper self-contained (and safe if the endpoint ever returns a broader result set).
 */
const isDwellingLocation = (location: IUserDwellingLocation, nowMs: number = Date.now()): boolean => {
    if (!location) {
        return false;
    }

    if (location.isDeclaredHome) {
        return true;
    }

    const distinctDayCount = toNumber(location.distinctDayCount);

    if (!Number.isFinite(distinctDayCount) || distinctDayCount < Location.DWELL_MIN_DISTINCT_DAYS) {
        return false;
    }

    // A dwelling the user has not returned to in a while (last year's hotel) should
    // no longer mute notifications.
    if (!location.lastVisitedAt) {
        return false;
    }

    const lastVisitedMs = new Date(location.lastVisitedAt).getTime();

    if (Number.isNaN(lastVisitedMs)) {
        return false;
    }

    return (nowMs - lastVisitedMs) <= Location.DWELL_LOCATION_MAX_AGE_MS;
};

/**
 * Returns the qualifying dwelling the user is currently at, or undefined when they are
 * somewhere else. Matching is by distance rather than by rounded-coordinate equality so
 * that GPS drift (and a home that straddles two rounded coordinate cells) still matches.
 */
const findCurrentDwellingLocation = (
    locations: IUserDwellingLocation[] | undefined,
    userLocation: IDwellingUserLocation,
    nowMs: number = Date.now(),
): IUserDwellingLocation | undefined => {
    if (!locations?.length || !userLocation
        || !Number.isFinite(userLocation.latitude) || !Number.isFinite(userLocation.longitude)) {
        return undefined;
    }

    return locations.find((location) => {
        if (!isDwellingLocation(location, nowMs)) {
            return false;
        }

        const latitude = toNumber(location.latitude);
        const longitude = toNumber(location.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return false;
        }

        const distanceMeters = distanceTo({
            lon: userLocation.longitude,
            lat: userLocation.latitude,
        }, {
            lon: longitude,
            lat: latitude,
        });

        return distanceMeters <= Location.DWELL_LOCATION_RADIUS_METERS;
    });
};

const isAtDwellingLocation = (
    locations: IUserDwellingLocation[] | undefined,
    userLocation: IDwellingUserLocation,
    nowMs: number = Date.now(),
): boolean => !!findCurrentDwellingLocation(locations, userLocation, nowMs);

export {
    isDwellingLocation,
    findCurrentDwellingLocation,
    isAtDwellingLocation,
};
