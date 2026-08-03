/**
 * The user-selectable content algorithms.
 *
 * Each value is a weight vector plus policy knobs over the four signals this system
 * actually collects (recency, engagement, interest affinity, geo proximity). They are
 * stored on `main.users.settingsContentAlgorithm` and picked in Settings alongside the
 * theme, so the string values here are also the values that reach the database.
 *
 * See docs/ALGORITHM_AUDIT.md for why there were four uncoordinated rankers before this.
 */
export enum ContentAlgorithms {
    /** Local discovery and serendipity. Geo dominant, engagement near-zero, hardest author diversity. */
    WANDER = 'wander',
    /** Precision. Hard-filtered to declared interests, small batches, lowest volume. */
    FOCUS = 'focus',
    /** Liveness. Recency and engagement dominant — this reproduces pre-abstraction behavior. */
    PULSE = 'pulse',
}

/**
 * PULSE, deliberately: its defaults reproduce the production hot score exactly (see
 * profiles.ts), so introducing the picker is behavior-preserving for every existing user.
 * Changing this default is a one-line change plus one documented feed reshuffle.
 */
export const DEFAULT_CONTENT_ALGORITHM = ContentAlgorithms.PULSE;

export interface IAlgorithmWeights {
    /**
     * The engagement-over-age "hot" term. This is a single term rather than separate
     * recency and engagement weights because the production formula multiplies them
     * (`(replyCount + 1) / (age + 2)^1.5`), and that shape is what is benchmarked and
     * indexed against. Engagement is tuned independently via `engagementWeight` below.
     */
    hotness: number;
    /** Weighted interest overlap (ALGORITHM_AUDIT O1.7), additive so it can lift older content. */
    interest: number;
    /** Distance proximity, additive. Only meaningful on surfaces that have coordinates. */
    geo: number;
}

export interface IAlgorithmProfile {
    key: ContentAlgorithms;
    weights: IAlgorithmWeights;
    /**
     * Coefficient on the engagement count inside the hot term's numerator. `1` reproduces
     * production. Lower values make the term behave more like pure recency, which is how
     * WANDER stops popular posts from crowding out nearby ones.
     */
    engagementWeight: number;
    /** Exponent on age. Higher = fresher feed. Production is 1.5. */
    recencyGravity: number;
    /** Added to age before exponentiation, so brand-new content does not divide by zero. Production is 2. */
    recencyOffsetHours: number;
    /** Distance at which the geo term decays to 1/e. */
    geoScaleMeters: number;
    /** Overrides Location.AREA_PROXIMITY_METERS for this profile's map searches. */
    searchRadiusMeters: number;
    /** Multiplier applied to a thought that matched the user's interests at activation. */
    interestMatchBoost: number;
    /** Rows scanned by the index-friendly inner query before re-ranking. */
    candidatePoolSize: number;
    /** Activation batch size range for the thought distributor. */
    minActivationBatch: number;
    maxActivationBatch: number;
    /** Author diversity cap within a single ranked batch. `0` means uncapped. */
    maxPerAuthor: number;
    /** When true, candidates MUST overlap the user's interests; when false, interests only boost. */
    hardInterestFilter: boolean;
}

const ALGORITHM_VALUES: string[] = Object.values(ContentAlgorithms);

export const isContentAlgorithm = (value: any): value is ContentAlgorithms => typeof value === 'string'
    && ALGORITHM_VALUES.includes(value);

/**
 * Coerces anything (a DB column, a request body field, a stale persisted redux value) to a
 * known algorithm. Never throws — an unrecognized value must degrade to the default rather
 * than fail a feed request.
 */
export const normalizeContentAlgorithm = (value: any): ContentAlgorithms => (isContentAlgorithm(value)
    ? value
    : DEFAULT_CONTENT_ALGORITHM);

export const CONTENT_ALGORITHM_VALUES: ContentAlgorithms[] = Object.values(ContentAlgorithms);
