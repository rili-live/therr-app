const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type IVariation = 'default' | 'short';

const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365;
const millisecondsPerDay = 1000 * 60 * 60 * 24;
const millisecondsPerHour = 1000 * 60 * 60;

const millisecondsPerMinute = 1000 * 60;

/**
 * Compact "how fresh is this" label for the map preview cards, where minute-level
 * granularity is the point — "12m" reads as happening now in a way "< 1h" does not.
 * Returns undefined past the caller's freshness window so the badge simply hides.
 */
export const compactTimeSince = (
    pastDate: Date,
    translate: (key: string, params?: any) => string,
    maxAgeMs = millisecondsPerHour * 2,
): string | undefined => {
    const differenceInMilliseconds = Date.now() - pastDate.getTime();

    if (Number.isNaN(differenceInMilliseconds) || differenceInMilliseconds < 0 || differenceInMilliseconds > maxAgeMs) {
        return undefined;
    }

    const minutesSince = Math.floor(differenceInMilliseconds / millisecondsPerMinute);
    if (minutesSince < 1) {
        return translate('dateTime.justNow');
    }

    if (minutesSince < 60) {
        return translate('dateTime.minutesSinceDate', { count: minutesSince });
    }

    return translate('dateTime.hoursSinceDate', {
        count: Math.floor(differenceInMilliseconds / millisecondsPerHour),
    });
};

export const hoursDaysOrYearsSince = (pastDate: Date, translate: (key: string, params?: any ) => string) => {
    const today = new Date();

    // Calculate the difference in milliseconds
    const differenceInMilliseconds = today.getTime() - pastDate.getTime();

    // Convert milliseconds to days
    const daysSinceDate = Math.floor(differenceInMilliseconds / millisecondsPerDay);
    if (daysSinceDate < 1) {
        const hoursSinceDate = Math.floor(differenceInMilliseconds / millisecondsPerHour);
        if (hoursSinceDate < 1) {
            return  translate('dateTime.lessThanHours');
        }
        return  translate('dateTime.hoursSinceDate', {
            count: hoursSinceDate,
        });
    } else if (daysSinceDate >= 365) {
        const yearsSinceDate = Math.floor(differenceInMilliseconds / millisecondsPerYear);
        return  translate('dateTime.yearsSinceDate', {
            count: yearsSinceDate,
        });
    }

    return translate('dateTime.daysSinceDate', {
        count: daysSinceDate,
    });
};

const formatDate = (
    unformattedDate,
    variation: IVariation = 'default',
): {
    date: string;
    time: string;
} => {
    if (!unformattedDate) {
        return {
            date: '',
            time: '',
        };
    }
    const date = new Date(unformattedDate);
    const year = date.getFullYear();
    const month = MONTHS[date.getMonth()];
    const day = date.getDate();

    let hours = date.getHours();
    const amPm = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) {
        hours = 12;
    }
    hours = hours > 12 ? hours - 12 : hours;
    const minute = date.getMinutes().toString();

    if (variation === 'short') {
        return {
            date: `${date.getMonth() + 1}/${day}/${year}`,
            time: `${hours}:${minute.padStart(2, '0')} ${amPm}`,
        };
    }

    return {
        date: `${month} ${day}, ${year}`,
        time: `${hours}:${minute.padStart(2, '0')} ${amPm}`,
    };
};

const RELATIVE_CUTOFF_MS = millisecondsPerDay * 7;

/**
 * Timestamp formatting for feed-style lists (notifications, activity).
 *
 * Recent entries read as an age ("3h", "2d") because that is what the reader is
 * actually asking — "did this just happen?". Past a week the age stops being
 * meaningful and an absolute date ("Jul 20, 2026") is easier to place. Reuses
 * the `dateTime.*` dictionary entries, so no new locale keys are required.
 */
export const formatRelativeOrAbsolute = (
    unformattedDate,
    translate: (key: string, params?: any) => string,
): string => {
    if (!unformattedDate) {
        return '';
    }

    const date = new Date(unformattedDate);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const ageMs = Date.now() - date.getTime();

    // Future-dated (clock skew) entries fall through to the absolute format
    // rather than rendering a nonsensical negative age.
    if (ageMs < 0 || ageMs >= RELATIVE_CUTOFF_MS) {
        return formatDate(date).date;
    }

    return hoursDaysOrYearsSince(date, translate);
};

export default formatDate;
