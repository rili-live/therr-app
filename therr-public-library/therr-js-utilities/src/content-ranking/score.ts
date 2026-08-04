import { IAlgorithmProfile } from './algorithms';

export interface IScoreComponents {
    /** Age of the content in hours. Negative values are clamped — see getHotnessTerm. */
    ageHours?: number | null;
    /** Raw engagement count for the content (reply count on thoughts, likes/views elsewhere). */
    engagementCount?: number | null;
    /** Weighted overlap between the content's interest keys and the user's affinity vector. */
    interestOverlap?: number | null;
    /** Distance from the user in meters. `null`/absent means the surface has no geography. */
    distanceMeters?: number | null;
    /** Whether this item matched the user's interests at candidate-selection time. */
    isInterestMatch?: boolean;
}

const toNonNegative = (value: number | null | undefined): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * The engagement-over-age "hot" term — a Hacker-News-style gravity curve, and the same shape
 * production has always used.
 *
 * The age clamp is load-bearing rather than defensive. `therr-ai-automator` post-dates
 * `main.thoughts` rows by up to ~30h to drip a run's output out over time, so negative ages
 * are routine, not exceptional. In SQL an unclamped negative base raised to a fractional
 * power is a hard Postgres ERROR that aborts the whole query — it froze the feed for 8 days.
 * Clamping here as well keeps the JS and SQL forms describing the same curve.
 */
export const getHotnessTerm = (components: IScoreComponents, profile: IAlgorithmProfile): number => {
    const ageHours = toNonNegative(components.ageHours);
    const numerator = (profile.engagementWeight * toNonNegative(components.engagementCount)) + 1;
    const denominator = (ageHours + profile.recencyOffsetHours) ** profile.recencyGravity;

    return denominator > 0 ? numerator / denominator : 0;
};

export const getInterestTerm = (components: IScoreComponents): number => toNonNegative(components.interestOverlap);

/**
 * Exponential proximity decay: 1.0 at the user's position, 1/e at `geoScaleMeters`.
 *
 * Returns 0 when there is no distance, which is the correct answer for the thoughts stream —
 * `main.thoughts` has no coordinates, so its geo term must contribute nothing rather than
 * defaulting to "infinitely close".
 */
export const getGeoTerm = (components: IScoreComponents, profile: IAlgorithmProfile): number => {
    const { distanceMeters } = components;
    if (distanceMeters === null || distanceMeters === undefined || !Number.isFinite(Number(distanceMeters))) {
        return 0;
    }
    if (profile.geoScaleMeters <= 0) {
        return 0;
    }

    return Math.exp(-(toNonNegative(distanceMeters) / profile.geoScaleMeters));
};

/**
 * Blends the weighted terms and applies the interest-match multiplier.
 *
 * The multiplier is applied to the whole blend (not just the interest term) because that is
 * what the distributor has always done — it keeps an interest match ahead of an equally-hot
 * general candidate without hard-partitioning the stream into two blocks.
 *
 * Must stay numerically identical to `getScoreSqlExpression` in ./sql-score. Both read the
 * same profile fields precisely so they cannot drift.
 */
export const scoreContent = (components: IScoreComponents, profile: IAlgorithmProfile): number => {
    const base = (profile.weights.hotness * getHotnessTerm(components, profile))
        + (profile.weights.interest * getInterestTerm(components))
        + (profile.weights.geo * getGeoTerm(components, profile));

    const boost = components.isInterestMatch ? profile.interestMatchBoost : 1;

    return base * boost;
};

/**
 * Caps how many items each author contributes, preserving relative order otherwise.
 *
 * The cap is on an author's TOTAL count in the list, not on consecutive runs — the first
 * `maxPerAuthor` items an author has keep their positions and the rest are appended after
 * every other kept item. (TherrMobile's `utilities/feedRanking.ts` has a separate helper of
 * the same name that instead breaks up consecutive runs by pulling a different author's post
 * forward; the two are not interchangeable.)
 *
 * Applied after scoring rather than inside it: diversity is a constraint on the emitted
 * sequence, not a property of any single item, so folding it into the score cannot express
 * "at most N of these".
 */
export const applyAuthorDiversity = <T extends { fromUserId?: any }>(items: T[], maxPerAuthor: number): T[] => {
    if (!items?.length || !maxPerAuthor || maxPerAuthor < 1) {
        return items;
    }

    const kept: T[] = [];
    const deferred: T[] = [];
    const countByAuthor = new Map<string, number>();

    items.forEach((item) => {
        const authorId = item.fromUserId === undefined || item.fromUserId === null ? '' : String(item.fromUserId);
        if (!authorId) {
            kept.push(item);
            return;
        }
        const seen = countByAuthor.get(authorId) || 0;
        if (seen < maxPerAuthor) {
            countByAuthor.set(authorId, seen + 1);
            kept.push(item);
        } else {
            // Over-cap items sink rather than vanish — the caller asked for a ranking of this
            // set, so dropping items would silently shorten a page.
            deferred.push(item);
        }
    });

    return [...kept, ...deferred];
};

/**
 * Ranks a page of already-fetched content, for anywhere a server-ranked page needs local
 * re-blending.
 *
 * No client consumes this yet. The mobile Areas carousels still rank locally through
 * `TherrMobile/main/utilities/feedRanking.ts`, which is profile-unaware and applies its own
 * fixed gravity — folding it onto this function is what would make a user's selected
 * algorithm apply to the carousels too. See docs/ALGORITHM_AUDIT.md.
 */
export const rankByScore = <T>(
    items: T[],
    profile: IAlgorithmProfile,
    toComponents: (item: T) => IScoreComponents,
): T[] => {
    if (!items?.length) {
        return items;
    }

    return items
        .map((item, index) => ({ item, index, score: scoreContent(toComponents(item), profile) }))
        // Original index as a stable tiebreak so equal scores keep the order the caller
        // supplied (which, server-side, is already the authoritative ranking).
        .sort((a, b) => (b.score - a.score) || (a.index - b.index))
        .map((scored) => scored.item);
};
