/**
 * Isomorphic content ranking helpers shared by backend feed endpoints and app clients.
 *
 * The score blends three signals:
 *   1. Recency — exponential half-life decay so fresh content floats without hard cutoffs
 *   2. Engagement — log-dampened reply and like counts (replies weigh more than likes,
 *      mirroring how conversation signals stickiness on social feeds)
 *   3. Personalization — a 0..1 interest match between the content and the viewing user
 *
 * All functions are pure so the same ordering can be reproduced on any platform, and
 * scoring a page of N posts is O(N) with no I/O.
 */

export interface IRankableContent {
    id?: string;
    createdAt: string | number | Date;
    likeCount?: number | null;
    replyCount?: number | null;
    replies?: { id: string }[] | null;
    interestMatchScore?: number | null;
    rankingScore?: number | null;
    [key: string]: any;
}

export interface IRankingWeights {
    recencyHalfLifeHours: number;
    replyWeight: number;
    likeWeight: number;
    interestWeight: number;
}

export const DEFAULT_RANKING_WEIGHTS: IRankingWeights = {
    recencyHalfLifeHours: 48,
    replyWeight: 1.5,
    likeWeight: 1,
    interestWeight: 0.75,
};

export const DEFAULT_MAX_AUTO_EXPANDED_PER_PAGE = 3;
export const DEFAULT_MIN_AUTO_EXPAND_SCORE = 0.05;

const getReplyCount = (content: IRankableContent): number => {
    if (typeof content.replyCount === 'number') {
        return Math.max(0, content.replyCount);
    }

    return Array.isArray(content.replies) ? content.replies.length : 0;
};

/**
 * Overlap coefficient between a post's interest keys and a user's interest keys.
 * Returns 0..1. Empty inputs yield 0 so unpersonalized requests are unaffected.
 */
export const getInterestMatchScore = (contentInterestKeys?: string[] | null, userInterestKeys?: string[] | null): number => {
    if (!contentInterestKeys?.length || !userInterestKeys?.length) {
        return 0;
    }

    const userKeySet = new Set(userInterestKeys);
    const matchedCount = contentInterestKeys.filter((key) => userKeySet.has(key)).length;
    const smallerSetSize = Math.min(contentInterestKeys.length, userInterestKeys.length);

    return smallerSetSize > 0 ? Math.min(1, matchedCount / smallerSetSize) : 0;
};

/**
 * Computes a relevance score for a post. Higher is more relevant.
 * A brand new post with no engagement scores 1.0; the score decays toward 0 with age
 * and is multiplied upward by engagement and interest match.
 */
export const getContentRankingScore = (
    content: IRankableContent,
    weights: IRankingWeights = DEFAULT_RANKING_WEIGHTS,
    nowMs: number = Date.now(),
): number => {
    if (typeof content.rankingScore === 'number') {
        return content.rankingScore;
    }

    const createdAtMs = new Date(content.createdAt).getTime();
    const ageHours = Number.isNaN(createdAtMs) ? 0 : Math.max(0, (nowMs - createdAtMs) / (1000 * 60 * 60));
    const recency = 0.5 ** (ageHours / weights.recencyHalfLifeHours);

    const likeCount = Math.max(0, content.likeCount || 0);
    const replyCount = getReplyCount(content);
    const interestMatch = Math.min(1, Math.max(0, content.interestMatchScore || 0));

    const engagement = 1
        + (weights.replyWeight * Math.log1p(replyCount))
        + (weights.likeWeight * Math.log1p(likeCount))
        + (weights.interestWeight * interestMatch);

    return recency * engagement;
};

export interface IAutoExpandOptions {
    maxAutoExpandedPerPage?: number;
    minScore?: number;
    weights?: IRankingWeights;
    nowMs?: number;
}

/**
 * Selects which threads in a page of thoughts should auto-expand (show their top reply
 * inline, like Twitter/X surfacing the top post of a thread). Only threads with at least
 * one reply qualify; the result is capped per page so the feed stays scannable and the
 * extra reply-hydration work stays bounded.
 */
export const selectAutoExpandedThoughtIds = (
    thoughts: IRankableContent[],
    options: IAutoExpandOptions = {},
): string[] => {
    const maxAutoExpandedPerPage = options.maxAutoExpandedPerPage ?? DEFAULT_MAX_AUTO_EXPANDED_PER_PAGE;
    const minScore = options.minScore ?? DEFAULT_MIN_AUTO_EXPAND_SCORE;
    const nowMs = options.nowMs ?? Date.now();

    return thoughts
        .filter((thought) => !!thought.id && getReplyCount(thought) > 0)
        .map((thought) => ({
            id: thought.id as string,
            score: getContentRankingScore(thought, options.weights, nowMs),
        }))
        .filter((candidate) => candidate.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxAutoExpandedPerPage)
        .map((candidate) => candidate.id);
};
