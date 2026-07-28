import logSpan from 'therr-js-utilities/log-or-update-span';

// Must match UserInterestsStore's write-side half-life, or a score decayed on write and a
// score decayed on read describe different curves.
const AFFINITY_HALF_LIFE_DAYS = Number(process.env.INTEREST_AFFINITY_HALF_LIFE_DAYS) || 45;
const AFFINITY_HALF_LIFE_MS = AFFINITY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;

// Fraction of shadow evaluations that get logged. Comparing rankings is cheap (it runs over
// rows already in memory) but the log line is not, and this fires on a hot path.
const SHADOW_LOG_SAMPLE_RATE = Number(process.env.INTEREST_SHADOW_LOG_SAMPLE_RATE) || 0.02;

export interface IInterestWeightRow {
    interestId: string;
    score?: number;
    engagementCount?: number;
    affinityScore?: number;
    negativeCount?: number;
    lastEngagedAt?: string | Date | null;
}

/**
 * The ranking currently in production.
 *
 * Note what this actually computes: `score` defaults to 5 and no client has ever sent
 * anything else, so in practice this is `ceil(engagementCount / 5)` — the declared-
 * preference dimension contributes nothing, and the ceil quantizes engagement 1-5 into a
 * single tied bucket. See docs/ALGORITHM_AUDIT.md E1.
 */
export const getInterestRanking = (engagementCount: number, score: number) => Math.ceil((engagementCount || 1) / (score || 5));

/**
 * Candidate replacement, evaluated in shadow only — nothing ranks on this yet.
 *
 * Differences that matter:
 *  - Decay is re-applied at read time. The stored score was decayed to whenever the row was
 *    last written, so a row untouched for months reads "stale high" unless the elapsed time
 *    since `lastEngagedAt` is discounted here too.
 *  - Declared and behavioral signals multiply rather than divide. The live formula divides
 *    engagement BY score, so a stronger declared preference produces a weaker ranking the
 *    moment `score` stops being a constant.
 *  - No `Math.ceil`, so the result keeps its resolution instead of collapsing into 2-3
 *    tied integer buckets.
 *  - Negative signals damp the weight. Nothing writes `negativeCount` yet (that is the
 *    hide/not-interested path), so today this term is always 1.
 */
export const getShadowInterestWeight = (row: IInterestWeightRow, now: number = Date.now()) => {
    const clampedScore = Math.min(Math.max(Number(row.score) || 5, 1), 5);
    // score 1 ("highest" per the column's own documentation) -> 1.0, score 5 -> 0.2
    const declaredWeight = (6 - clampedScore) / 5;

    const stored = Math.max(Number(row.affinityScore) || 0, 0);
    const lastEngagedAt = row.lastEngagedAt ? new Date(row.lastEngagedAt).getTime() : null;
    const elapsedMs = lastEngagedAt && Number.isFinite(lastEngagedAt) ? Math.max(now - lastEngagedAt, 0) : 0;
    const decayed = stored * (0.5 ** (elapsedMs / AFFINITY_HALF_LIFE_MS));

    const negativeCount = Math.max(Number(row.negativeCount) || 0, 0);

    return (declaredWeight * (1 + Math.log1p(decayed))) / (1 + (negativeCount * 0.5));
};

const rankByDescending = (rows: IInterestWeightRow[], weigh: (row: IInterestWeightRow) => number) => [...rows]
    // interestId as a stable tiebreak so ties don't register as disagreement purely
    // because two equal weights came back in a different order.
    .sort((a, b) => (weigh(b) - weigh(a)) || String(a.interestId).localeCompare(String(b.interestId)))
    .map((row) => row.interestId);

/**
 * Measures how far the shadow ranking moves an ordering versus the live one.
 *
 * Reported as normalized Spearman footrule (0 = identical ordering, 1 = maximally
 * reversed) plus top-5 overlap, which is the part a user would actually notice.
 */
export const compareInterestRankings = (rows: IInterestWeightRow[], now: number = Date.now()) => {
    if (!rows?.length || rows.length < 2) {
        return null;
    }

    const liveOrder = rankByDescending(rows, (row) => getInterestRanking(row.engagementCount as number, row.score as number));
    const shadowOrder = rankByDescending(rows, (row) => getShadowInterestWeight(row, now));

    const livePositions = new Map(liveOrder.map((id, index) => [id, index]));
    const displacement = shadowOrder.reduce((sum, id, index) => sum + Math.abs((livePositions.get(id) ?? index) - index), 0);
    // Max footrule for n items is floor(n^2 / 2); normalize so the number is comparable
    // across users with different numbers of enabled interests.
    const maxDisplacement = Math.floor((rows.length ** 2) / 2) || 1;

    const topN = Math.min(5, rows.length);
    const liveTop = new Set(liveOrder.slice(0, topN));
    const sharedTop = shadowOrder.slice(0, topN).filter((id) => liveTop.has(id)).length;

    return {
        interestCount: rows.length,
        footruleNormalized: Number((displacement / maxDisplacement).toFixed(4)),
        topOverlap: Number((sharedTop / topN).toFixed(4)),
    };
};

/**
 * Sampled shadow comparison. Never throws — this is observability hanging off a live
 * request path, so a bug here must not be able to fail the request it is measuring.
 */
export const logShadowInterestRanking = (userId: string, rows: IInterestWeightRow[]) => {
    try {
        if (Math.random() >= SHADOW_LOG_SAMPLE_RATE) {
            return;
        }
        const comparison = compareInterestRankings(rows);
        if (!comparison) {
            return;
        }
        logSpan({
            level: 'info',
            messageOrigin: 'INTEREST_RANKING_SHADOW',
            messages: ['Shadow interest ranking comparison'],
            traceArgs: {
                'user.id': userId,
                'interest.count': comparison.interestCount,
                'interest.shadowFootrule': comparison.footruleNormalized,
                'interest.shadowTopOverlap': comparison.topOverlap,
            },
        });
    } catch {
        // Observability must never break the caller.
    }
};
