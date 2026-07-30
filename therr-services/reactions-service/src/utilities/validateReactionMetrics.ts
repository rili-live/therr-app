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
            const numeric = Number(value);

            if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
                return `${key} must be an integer between ${min} and ${max}`;
            }
        }
    }

    return null;
};

export default validateReactionMetrics;
