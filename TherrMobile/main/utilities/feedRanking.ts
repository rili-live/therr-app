/**
 * Client-side feed ranking for the Areas carousels (Discoveries/Thoughts tabs).
 *
 * Ranks the already-fetched page of posts by a lightweight engagement score:
 * recency decay (gravity) x engagement (likes, replies, views) x a personalization
 * boost for categories the user has previously liked/bookmarked. Runs on at most a
 * few hundred cached posts per refresh, so it stays cheap enough to compute in render.
 *
 * Server-side, the analogous ranking happens in users-service
 * ThoughtsStore.getRecentThoughts (stream activation candidates). Keep the two
 * philosophically aligned: engagement dampened by age.
 */

// How quickly older content loses rank; higher = fresher feed
const RECENCY_GRAVITY = 1.1;
// Multiplier for posts in categories the user has engaged with
const CATEGORY_AFFINITY_BOOST = 1.25;
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

export const getPostRankingScore = (post: IRankablePost, context: IRankingContext): number => {
    const createdAtMs = new Date(post.createdAt).getTime();
    const ageHours = Math.max((context.nowMs - createdAtMs) / MS_PER_HOUR, 0);
    const recency = 1 / Math.pow(ageHours + 2, RECENCY_GRAVITY);
    const engagement = Math.log1p(
        (post.likeCount || 0) * 3
        + getReplyCount(post) * 2
        + (post.viewCount || 0) * 0.25,
    );
    const affinityBoost = context.categoryAffinity[getPostCategory(post)] ? CATEGORY_AFFINITY_BOOST : 1;

    return recency * (1 + engagement) * affinityBoost;
};

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

export const rankFeedPosts = (posts: IRankablePost[]): IRankablePost[] => {
    if (!posts?.length) {
        return posts;
    }

    const context: IRankingContext = {
        nowMs: Date.now(),
        categoryAffinity: buildCategoryAffinityMap(posts),
    };

    const ranked = posts
        .map((post) => ({ post, score: getPostRankingScore(post, context) }))
        .sort((a, b) => (b.score - a.score)
            || (new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()))
        .map((scored) => scored.post);

    return applyAuthorDiversity(ranked);
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
