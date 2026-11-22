import { getDistanceInMeters, getReadableDistance } from 'therr-js-utilities/location';

/**
 * Small, pure display helpers shared by the Drops screens (docs/DROPS.md).
 */

const METERS_PER_MILE = 1609.344;

export const getDropUserName = (dropUser?: { userName?: string } | null): string => dropUser?.userName || '';

/**
 * `openedOn` is a bare day (YYYY-MM-DD) by design — the server never tells the sender the time.
 * Format it as a calendar date without letting the device's timezone shift it a day.
 */
export const formatDropDay = (day: string, locale = 'en-us'): string => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
    if (!match) {
        return day || '';
    }
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    try {
        return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch {
        return day;
    }
};

/** Distance from the user to a drop, or null when either point is unknown. */
export const getDistanceToDropMeters = (
    from: { latitude?: number; longitude?: number } | null | undefined,
    drop: { latitude: number; longitude: number },
): number | null => {
    if (!from || from.latitude == null || from.longitude == null) {
        return null;
    }
    const meters = getDistanceInMeters(Number(from.latitude), Number(from.longitude), Number(drop.latitude), Number(drop.longitude));
    return Number.isFinite(meters) ? meters : null;
};

export const formatDropDistance = (meters: number): string => getReadableDistance(meters / METERS_PER_MILE);
