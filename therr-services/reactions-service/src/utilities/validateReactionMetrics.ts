import { Reactions } from 'therr-js-utilities/constants';

interface IBound {
    key: string;
    min: number;
    max: number;
}

const SHARED_BOUNDS: IBound[] = [
    {
        key: 'userViewCount',
        min: Reactions.USER_VIEW_COUNT_MIN,
        max: Reactions.USER_VIEW_COUNT_MAX,
    },
    {
        key: 'userBookmarkPriority',
        min: Reactions.USER_BOOKMARK_PRIORITY_MIN,
        max: Reactions.USER_BOOKMARK_PRIORITY_MAX,
    },
];

const RATING_BOUND: IBound = {
    key: 'rating',
    min: Reactions.RATING_MIN,
    max: Reactions.RATING_MAX,
};

/**
 * Checks the client-supplied numeric fields on a reaction create/update body.
 *
 * The API gateway already rejects out-of-range values for the single-reaction
 * routes, but the /create-update/multiple routes are internal-only and are not
 * registered in the gateway's reactions router, so they never see that
 * validation. Those are also the higher-leverage target: they spread one body
 * across N rows.
 *
 * Returns null when the body is acceptable, or a human-readable message naming
 * the first offending field.
 */
const validateReactionMetrics = (body: any, { withRating = false }: { withRating?: boolean } = {}): string | null => {
    if (!body) {
        return null;
    }

    const bounds = withRating ? [...SHARED_BOUNDS, RATING_BOUND] : SHARED_BOUNDS;

    for (let i = 0; i < bounds.length; i += 1) {
        const { key, min, max } = bounds[i];
        const value = body[key];

        // Absent is fine — every one of these columns is optional on write.
        if (value !== undefined && value !== null) {
            // Only a number or a numeric string may be coerced. `Number()` alone would
            // wave through types that are not metrics at all: `Number([])` is 0,
            // `Number([50])` is 50, `Number(true)` is 1, `Number('')` is 0. Each of those
            // would clear the bound below and then reach the handlers' `existing + body`
            // arithmetic as a non-number.
            const isCoercible = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
            const numeric = isCoercible ? Number(value) : NaN;

            if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
                return `${key} must be an integer between ${min} and ${max}`;
            }
        }
    }

    return null;
};

export default validateReactionMetrics;
