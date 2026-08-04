import {
    ContentAlgorithms,
    DEFAULT_CONTENT_ALGORITHM,
    IAlgorithmProfile,
    isContentAlgorithm,
    normalizeContentAlgorithm,
} from './algorithms';

/**
 * Isomorphic env access.
 *
 * `process` is absent in browser bundles and is only partially populated in React Native,
 * and webpack's DefinePlugin only substitutes *statically written* `process.env.FOO` — a
 * dynamic lookup like this one is never substituted. That is intentional: overrides are a
 * server-side tuning lever, and clients always compile the defaults below.
 *
 * The resulting divergence is cosmetic by design. The server is authoritative for ordering;
 * the mobile client only re-shuffles a page it already received in server-ranked order.
 */
const getEnv = (): { [key: string]: string | undefined } => {
    if (typeof process === 'undefined' || !process || !process.env) {
        return {};
    }
    return process.env;
};

/**
 * Parses rather than `||`-defaults, because 0 is a meaningful value for every weight here —
 * it is how an operator switches a whole term off without a deploy, and `||` would silently
 * restore the default at exactly that moment. Same reasoning as
 * `INTEREST_SHADOW_LOG_SAMPLE_RATE` in users-service `utilities/interestWeights.ts`.
 */
export const numberFromEnv = (name: string, fallback: number): number => {
    const raw = getEnv()[name];
    if (raw === undefined || raw === null || raw === '') {
        return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const boolFromEnv = (name: string, fallback: boolean): boolean => {
    const raw = getEnv()[name];
    if (raw === undefined || raw === null || raw === '') {
        return fallback;
    }
    return raw === 'true' || raw === '1';
};

const envKey = (key: ContentAlgorithms, field: string) => `ALGO_${key.toUpperCase()}_${field}`;

type IProfileDefaults = Omit<IAlgorithmProfile, 'key'>;

/**
 * Compile-time defaults. Every field is overridable via `ALGO_<KEY>_<FIELD>`.
 *
 * PULSE is load-bearing: its values reproduce the pre-abstraction production ranker
 * exactly — `engagementWeight: 1`, `recencyGravity: 1.5`, `recencyOffsetHours: 2`,
 * `candidatePoolSize: 200`, batch 7-20, `interestMatchBoost: 1.5`, and interest/geo
 * weights of 0 so no new term contributes. `content-ranking` unit tests assert the SQL it
 * emits is byte-identical to the historical `HOT_SCORE_EXPRESSION`. Do not retune PULSE
 * without accepting a feed reshuffle for every user who never touched the picker.
 */
const PROFILE_DEFAULTS: { [key in ContentAlgorithms]: IProfileDefaults } = {
    [ContentAlgorithms.WANDER]: {
        weights: { hotness: 0.2, interest: 0.3, geo: 1.0 },
        engagementWeight: 0.1,
        recencyGravity: 0.8,
        recencyOffsetHours: 2,
        geoScaleMeters: 800,
        searchRadiusMeters: 3000,
        interestMatchBoost: 1.1,
        candidatePoolSize: 400,
        minActivationBatch: 7,
        maxActivationBatch: 14,
        maxPerAuthor: 1,
        hardInterestFilter: false,
    },
    [ContentAlgorithms.FOCUS]: {
        weights: { hotness: 0.3, interest: 1.0, geo: 0.2 },
        engagementWeight: 0.2,
        recencyGravity: 1.2,
        recencyOffsetHours: 2,
        geoScaleMeters: 1000,
        searchRadiusMeters: 1000,
        interestMatchBoost: 1.5,
        candidatePoolSize: 300,
        minActivationBatch: 7,
        maxActivationBatch: 20,
        maxPerAuthor: 2,
        hardInterestFilter: true,
    },
    [ContentAlgorithms.PULSE]: {
        weights: { hotness: 1.0, interest: 0, geo: 0 },
        engagementWeight: 1,
        recencyGravity: 1.5,
        recencyOffsetHours: 2,
        geoScaleMeters: 1000,
        searchRadiusMeters: 1000,
        interestMatchBoost: 1.5,
        candidatePoolSize: 200,
        minActivationBatch: 7,
        maxActivationBatch: 20,
        // 0 = uncapped. Production applies no author diversity constraint at all, and PULSE
        // exists to be exactly production. WANDER and FOCUS are where diversity is enforced.
        maxPerAuthor: 0,
        hardInterestFilter: false,
    },
};

const buildProfile = (key: ContentAlgorithms): IAlgorithmProfile => {
    const defaults = PROFILE_DEFAULTS[key];

    return {
        key,
        weights: {
            hotness: numberFromEnv(envKey(key, 'WEIGHT_HOTNESS'), defaults.weights.hotness),
            interest: numberFromEnv(envKey(key, 'WEIGHT_INTEREST'), defaults.weights.interest),
            geo: numberFromEnv(envKey(key, 'WEIGHT_GEO'), defaults.weights.geo),
        },
        engagementWeight: numberFromEnv(envKey(key, 'ENGAGEMENT_WEIGHT'), defaults.engagementWeight),
        recencyGravity: numberFromEnv(envKey(key, 'GRAVITY'), defaults.recencyGravity),
        recencyOffsetHours: numberFromEnv(envKey(key, 'RECENCY_OFFSET_HOURS'), defaults.recencyOffsetHours),
        geoScaleMeters: numberFromEnv(envKey(key, 'GEO_SCALE_METERS'), defaults.geoScaleMeters),
        searchRadiusMeters: numberFromEnv(envKey(key, 'SEARCH_RADIUS_METERS'), defaults.searchRadiusMeters),
        interestMatchBoost: numberFromEnv(envKey(key, 'INTEREST_MATCH_BOOST'), defaults.interestMatchBoost),
        candidatePoolSize: numberFromEnv(envKey(key, 'CANDIDATE_POOL_SIZE'), defaults.candidatePoolSize),
        minActivationBatch: numberFromEnv(envKey(key, 'MIN_ACTIVATION_BATCH'), defaults.minActivationBatch),
        maxActivationBatch: numberFromEnv(envKey(key, 'MAX_ACTIVATION_BATCH'), defaults.maxActivationBatch),
        maxPerAuthor: numberFromEnv(envKey(key, 'MAX_PER_AUTHOR'), defaults.maxPerAuthor),
        hardInterestFilter: boolFromEnv(envKey(key, 'HARD_INTEREST_FILTER'), defaults.hardInterestFilter),
    };
};

/**
 * Resolves the profile for a stored setting value.
 *
 * `CONTENT_ALGORITHM_OVERRIDE` forces every user onto one profile regardless of their
 * setting. This is the single-flip production rollback if a profile misbehaves; it is
 * ignored unless it names a real algorithm.
 */
export const getAlgorithmProfile = (value?: any): IAlgorithmProfile => {
    const override = getEnv().CONTENT_ALGORITHM_OVERRIDE;
    // Checked for validity before it is allowed to win, rather than normalized alongside the
    // user's value. Normalizing them together means a typo'd override is still "set", so it
    // beats the user's setting and then falls back to the default — silently forcing every
    // user onto PULSE, which is the opposite of ignoring an unusable override.
    const key = isContentAlgorithm(override) ? override : normalizeContentAlgorithm(value);

    return buildProfile(key);
};

export const getDefaultAlgorithmProfile = (): IAlgorithmProfile => getAlgorithmProfile(DEFAULT_CONTENT_ALGORITHM);

/** Exposed for tests and for the profile-comparison logging added in the observability phase. */
export const getAllAlgorithmProfiles = (): IAlgorithmProfile[] => Object.values(ContentAlgorithms)
    .map((key) => buildProfile(key));
