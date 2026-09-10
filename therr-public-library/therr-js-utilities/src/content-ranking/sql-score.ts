import { IAlgorithmProfile } from './algorithms';

/**
 * SQL fragments naming where each score component comes from in the caller's query.
 *
 * These are interpolated raw. They are developer-authored column references and expressions
 * (`'"replyCount"'`, `'ST_Distance(geom::geography, ST_MakePoint(?, ?)::geography)'`), never
 * user input — same contract as the existing raw fragments in the *Store classes. Anything
 * derived from a request must be passed as a bound parameter inside the fragment, not
 * concatenated into it.
 */
export interface ISqlScoreColumns {
    /** Engagement count column, e.g. `'"replyCount"'`. */
    engagementCount: string;
    /** Timestamp column the age is measured from, e.g. `'"createdAt"'`. */
    createdAt: string;
    /** Optional weighted interest-overlap expression or column, e.g. `'"scoreInterest"'`. */
    interestOverlap?: string;
    /** Optional distance-in-meters expression. Omit on surfaces with no geography. */
    distanceMeters?: string;
    /** Optional boolean expression that, when true, applies the profile's interest-match boost. */
    isInterestMatch?: string;
}

/**
 * Serializes a profile constant into SQL.
 *
 * Profile values come from `Number()`-parsed env vars, so they are already numeric — this
 * exists to make a non-finite value fail loudly at query-build time rather than emit
 * `NaN`/`Infinity` into SQL, where Postgres would reject it far from the cause.
 */
const num = (value: number, field: string): string => {
    if (!Number.isFinite(value)) {
        throw new Error(`content-ranking: non-finite value for "${field}" (${value}); check its ALGO_* env override`);
    }
    return String(value);
};

/**
 * Age in hours, clamped at zero.
 *
 * `GREATEST(..., 0)` is not cosmetic. `therr-ai-automator` post-dates `main.thoughts` rows to
 * drip a run's output out over ~30h, so future-dated rows are routinely present. A negative
 * base raised to a non-integer power is a hard Postgres ERROR ("a negative number raised to a
 * non-integer power yields a complex result"), not a NULL — it aborts the entire candidate
 * query. One such row silently froze the activation feed for every user for 8 days
 * (2026-07-22 → 2026-07-30). Callers should ALSO exclude future rows; this is the second line
 * of defense, because the cost of getting it wrong is a total feed outage rather than one
 * mis-ranked post.
 */
export const getAgeHoursSqlExpression = (createdAtColumn: string): string => `GREATEST(EXTRACT(EPOCH FROM (NOW() - ${createdAtColumn})) / 3600, 0)`;

export const getHotnessSqlExpression = (profile: IAlgorithmProfile, columns: ISqlScoreColumns): string => {
    // Emitted without the coefficient when it is exactly 1, so PULSE reproduces the historical
    // HOT_SCORE_EXPRESSION byte for byte. A behavior-preserving default is only credible if it
    // is literally the same string, and there is a test asserting exactly that.
    const numerator = profile.engagementWeight === 1
        ? `(${columns.engagementCount} + 1)`
        : `((${num(profile.engagementWeight, 'engagementWeight')} * ${columns.engagementCount}) + 1)`;

    const ageHours = getAgeHoursSqlExpression(columns.createdAt);
    const offset = num(profile.recencyOffsetHours, 'recencyOffsetHours');
    const gravity = num(profile.recencyGravity, 'recencyGravity');

    return `${numerator} / POWER(${ageHours} + ${offset}, ${gravity})`;
};

export const getGeoSqlExpression = (profile: IAlgorithmProfile, distanceExpression: string): string => {
    const scale = num(profile.geoScaleMeters, 'geoScaleMeters');

    return `EXP(-1 * GREATEST(${distanceExpression}, 0) / ${scale})`;
};

/**
 * The profile's full ranking expression, for use in BOTH the SELECT list and the ORDER BY.
 *
 * Call it once and reuse the string in both places. The returned score has to be the same
 * number the ordering used — computing them from two separate call sites is how they drift.
 *
 * Terms whose weight is 0, and terms whose source column the caller did not supply, are
 * omitted entirely rather than multiplied by zero. That keeps the emitted SQL minimal (no
 * dead `ST_Distance` call on a surface that has no geography) and is what lets PULSE, whose
 * interest and geo weights are 0, emit exactly the legacy expression.
 */
export const getScoreSqlExpression = (profile: IAlgorithmProfile, columns: ISqlScoreColumns): string => {
    const terms: string[] = [];

    if (profile.weights.hotness) {
        const hotness = getHotnessSqlExpression(profile, columns);
        terms.push(profile.weights.hotness === 1
            ? hotness
            : `(${num(profile.weights.hotness, 'weights.hotness')} * (${hotness}))`);
    }

    if (profile.weights.interest && columns.interestOverlap) {
        terms.push(`(${num(profile.weights.interest, 'weights.interest')} * COALESCE(${columns.interestOverlap}, 0))`);
    }

    if (profile.weights.geo && columns.distanceMeters) {
        terms.push(`(${num(profile.weights.geo, 'weights.geo')} * ${getGeoSqlExpression(profile, columns.distanceMeters)})`);
    }

    // Every term was weighted to zero or its source column was not supplied. Emit a constant
    // rather than an empty string so the caller still produces valid SQL — the resulting
    // ordering is arbitrary but the query runs, which is the right failure mode for a
    // misconfigured weight set on a live feed.
    if (!terms.length) {
        return '0';
    }

    const base = terms.length === 1 ? terms[0] : `(${terms.join(' + ')})`;

    if (columns.isInterestMatch && profile.interestMatchBoost !== 1) {
        const boost = num(profile.interestMatchBoost, 'interestMatchBoost');
        return `(${base} * CASE WHEN ${columns.isInterestMatch} THEN ${boost} ELSE 1 END)`;
    }

    return base;
};
