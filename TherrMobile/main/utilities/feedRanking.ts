/**
 * Client-side feed ranking for the Areas carousels (Discoveries/Thoughts tabs).
 *
 * Ranks the already-fetched page of posts by a lightweight engagement score:
 * recency decay (gravity) x engagement (likes, replies, views) x a personalization
 * boost for categories the user has previously liked/bookmarked. Runs on at most a
 * few hundred cached posts per refresh, so it stays cheap enough to compute in render.
 *
 * The curve itself now comes from the user's selected content algorithm
 * (`settingsContentAlgorithm`) via therr-js-utilities `content-ranking`, which is the same
 * module users-service ThoughtsStore.getRecentThoughts ranks stream activation with. Before
 * this, the carousels applied their own fixed gravity regardless of the setting, so picking
 * Focus visibly changed which posts got activated but not how the list the user actually
 * scrolls was ordered. See docs/ALGORITHM_AUDIT.md.
 *
 * What stays local is what the server has no data for: this file decides what counts as
 * engagement (likes/replies/views, log-dampened) and derives an interest signal from the
 * user's own reactions in the cached page. The profile decides how those are weighed.
 */
import {
    IAlgorithmProfile,
    IScoreComponents,
    applyAuthorDiversity as capPerAuthor,
    getAlgorithmProfile,
    rankByScore,
    scoreContent,
} from 'therr-js-utilities/content-ranking';

const MS_PER_HOUR = 1000 * 60 * 60;

interface IRankablePost {
    id?: string;
    createdAt: string | Date;
    fromUserId?: string;
    category?: string;
    likeCount?: number;
    viewCount?: number;
    replyCount?: number;
    replies?: any[];
    reaction?: {
        userHasLiked?: boolean;
        userBookmarkCategory?: string | null;
        userHasSuperLiked?: boolean;
    };
    areaType?: string;
    isDraft?: boolean;
    [key: string]: any;
}

interface IRankingContext {
    nowMs: number;
    categoryAffinity: { [category: string]: number };
    profile: IAlgorithmProfile;
    /**
     * The largest affinity count in `categoryAffinity`, used to normalize the interest term
     * to 0..1. Without it the term would be a raw engagement tally, which under FOCUS (whose
     * interest weight is 1.0 against a hotness weight of 0.3) would let a single heavily-liked
     * category outrank everything else by an arbitrary factor.
     */
    maxCategoryAffinity: number;
}

const getPostCategory = (post: IRankablePost): string => post.category || 'uncategorized';

export const getReplyCount = (post: IRankablePost): number => {
    if (post.replyCount != null) {
        return post.replyCount;
    }
    return post.replies?.length || 0;
};

/**
 * Derives a category-affinity map from the user's own reactions within the cached
 * posts (likes, bookmarks, super-likes). Zero-network personalization signal.
 */
export const buildCategoryAffinityMap = (posts: IRankablePost[]): { [category: string]: number } => {
    const affinityMap: { [category: string]: number } = {};

    posts.forEach((post) => {
        const reaction = post.reaction;
        if (reaction?.userHasLiked || reaction?.userBookmarkCategory || reaction?.userHasSuperLiked) {
            const category = getPostCategory(post);
            affinityMap[category] = (affinityMap[category] || 0) + 1;
        }
    });

    return affinityMap;
};

/**
 * Maps a post onto the signals the shared profile knows how to weigh. This is the whole of
 * mobile's local ranking opinion; everything past it belongs to the selected algorithm.
 */
const toScoreComponents = (post: IRankablePost, context: IRankingContext): IScoreComponents => {
    const affinity = context.categoryAffinity[getPostCategory(post)] || 0;

    return {
        ageHours: Math.max((context.nowMs - new Date(post.createdAt).getTime()) / MS_PER_HOUR, 0),
        // Log-dampened so one viral post cannot bury a whole page of fresher content. This is
        // what the carousels have always used, and it is deliberately kept on the mobile side:
        // the shared profile weighs an engagement count, it does not define what to count.
        engagementCount: Math.log1p(
            (post.likeCount || 0) * 3
            + getReplyCount(post) * 2
            + (post.viewCount || 0) * 0.25,
        ),
        // Normalized 0..1 rather than a raw count — see maxCategoryAffinity.
        interestOverlap: context.maxCategoryAffinity > 0 ? affinity / context.maxCategoryAffinity : 0,
        // No coordinates on a cached carousel page, so distanceMeters is left absent and the
        // geo term contributes 0 rather than reading as "infinitely close".
        isInterestMatch: affinity > 0,
    };
};

export const getPostRankingScore = (post: IRankablePost, context: IRankingContext): number => scoreContent(
    toScoreComponents(post, context),
    context.profile,
);

/**
 * Prevents a wall of posts from one author: when a post would be the 3rd
 * consecutive from the same author, the next post by a different author is
 * pulled forward in its place.
 */
export const applyAuthorDiversity = (posts: IRankablePost[]): IRankablePost[] => {
    const result = [...posts];

    for (let i = 2; i < result.length; i += 1) {
        const authorId = result[i].fromUserId;
        if (authorId && authorId === result[i - 1].fromUserId && authorId === result[i - 2].fromUserId) {
            let j = i + 1;
            while (j < result.length && result[j].fromUserId === authorId) {
                j += 1;
            }
            if (j < result.length) {
                const [nextDifferent] = result.splice(j, 1);
                result.splice(i, 0, nextDifferent);
            }
        }
    }

    return result;
};

/**
 * @param contentAlgorithm the user's `settingsContentAlgorithm`. Anything unrecognized (an
 * older cached redux value, or an algorithm this build predates) degrades to the default
 * rather than throwing — `getAlgorithmProfile` normalizes it.
 */
export const rankFeedPosts = (posts: IRankablePost[], contentAlgorithm?: string): IRankablePost[] => {
    if (!posts?.length) {
        return posts;
    }

    const categoryAffinity = buildCategoryAffinityMap(posts);
    const affinityCounts = Object.values(categoryAffinity);
    const context: IRankingContext = {
        nowMs: Date.now(),
        categoryAffinity,
        profile: getAlgorithmProfile(contentAlgorithm),
        maxCategoryAffinity: affinityCounts.length ? Math.max(...affinityCounts) : 0,
    };

    // Callers hand this list over already sorted by createdAt descending, so rankByScore's
    // original-index tiebreak preserves the recency ordering that equal scores used to fall
    // back on explicitly.
    const ranked = rankByScore(posts, context.profile, (post) => toScoreComponents(post, context));

    // Two different constraints, applied in order. The profile's cap limits an author's total
    // share of the page (FOCUS keeps 2; PULSE is uncapped and this is a no-op), and can leave
    // the deferred overflow bunched at the tail — so the consecutive-run pass runs afterwards
    // to smooth whatever the cap produced.
    const capped = context.profile.maxPerAuthor > 0
        ? capPerAuthor(ranked, context.profile.maxPerAuthor)
        : ranked;

    return applyAuthorDiversity(capped);
};

/**
 * The reply surfaced in an auto-expanded thread preview: most liked, then most recent.
 */
export const getTopReply = (thought: IRankablePost) => {
    if (!thought?.replies?.length) {
        return undefined;
    }

    return [...thought.replies]
        .filter((reply) => !!reply?.message)
        .sort((a, b) => ((b.likeCount || 0) - (a.likeCount || 0))
            || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))[0];
};

/**
 * Auto-expand criteria: threads with real conversation (2+ replies) always expand;
 * single-reply threads only expand when there is a like signal on the parent or reply.
 */
export const shouldAutoExpandThread = (thought: IRankablePost): boolean => {
    if (!thought || thought.areaType || thought.isDraft) {
        return false;
    }

    const topReply = getTopReply(thought);
    if (!topReply) {
        return false;
    }

    if (getReplyCount(thought) >= 2) {
        return true;
    }

    return (thought.likeCount || 0) >= 1 || (topReply.likeCount || 0) >= 1;
};
