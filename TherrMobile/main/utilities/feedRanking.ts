/**
 * Client-side ranking for the two surfaces that order already-fetched content locally:
 * the Areas carousels (Discoveries/Thoughts tabs) and the map preview card strip.
 *
 * Feed ranking (rankFeedPosts) scores a page of posts by recency decay (gravity)
 * x engagement (likes, replies, views) x a personalization boost for categories the
 * user has previously liked/bookmarked. Runs on at most a few hundred cached posts per
 * refresh, so it stays cheap enough to compute in render.
 *
 * Map preview ranking (rankAreaPreviews) adds proximity as a first-class term and
 * switches to an additive blend — see the comment above AREA_WEIGHT_GEO for why.
 *
 * Server-side, the analogous ranking happens in users-service
 * ThoughtsStore.getRecentThoughts (stream activation candidates). Keep the three
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
    // Map preview strip only
    spaceId?: string;
    scheduleStartAt?: string | Date;
    featuredIncentiveRewardKey?: string;
    distanceFromPress?: number;
    distanceFromUser?: number;
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

/*
 * ---------------------------------------------------------------------------
 * Map preview strip ranking
 * ---------------------------------------------------------------------------
 */

// Distance at which the proximity term decays to 1/e. Tuned near the backend's
// Location.AREA_PROXIMITY_METERS (1000) so the client and the server agree about
// what "nearby" means.
const GEO_SCALE_METERS = 800;

// The feed multiplies recency by engagement. The preview strip cannot: it mixes
// moments (minutes old) with spaces (persistent business pages, often created years
// ago). A multiplicative recency term would drive every space to ~0 and the strip
// would show nothing but moments. So the terms are added, and a space earns its
// recency from activity *at* it rather than from its own createdAt.
const AREA_WEIGHT_GEO = 1;
const AREA_WEIGHT_RECENCY = 0.8;
const AREA_WEIGHT_ACTIVITY = 0.5;
const AREA_WEIGHT_FEATURED = 0.2;

const METERS_PER_MILE = 1609.34;

export interface IAreaActivity {
    latestActivityMs?: number;
    activityCount: number;
}

export interface IAreaPreviewContext {
    nowMs: number;
    spaceActivity: { [spaceId: string]: IAreaActivity };
}

/**
 * Derives "recent activity at this space" from the moments already fetched for the
 * map. Moments carry a spaceId, so the newest moment at a space — and how many there
 * are — is a real activity signal available with no extra request.
 *
 * This is the client-side stand-in for the denormalized activityScore/lastActivityAt
 * columns specified for maps-service. When those land, this map is replaced by the
 * server-provided values and the scoring below is unchanged.
 */
export const buildSpaceActivityMap = (moments: IRankablePost[]): { [spaceId: string]: IAreaActivity } => {
    const activity: { [spaceId: string]: IAreaActivity } = {};

    (moments || []).forEach((moment) => {
        const spaceId = moment?.spaceId;
        if (!spaceId) {
            return;
        }
        const createdAtMs = new Date(moment.createdAt).getTime();
        const existing = activity[spaceId];
        if (!existing) {
            activity[spaceId] = {
                latestActivityMs: Number.isNaN(createdAtMs) ? undefined : createdAtMs,
                activityCount: 1,
            };
            return;
        }
        existing.activityCount += 1;
        if (!Number.isNaN(createdAtMs) && (existing.latestActivityMs == null || createdAtMs > existing.latestActivityMs)) {
            existing.latestActivityMs = createdAtMs;
        }
    });

    return activity;
};

/**
 * The timestamp that represents "something happened here" for each area type.
 * Returns undefined when the area has no meaningful recency signal, in which case
 * the recency term contributes nothing rather than penalizing the area.
 */
const getAreaActivityMs = (area: IRankablePost, context: IAreaPreviewContext): number | undefined => {
    if (area.areaType === 'spaces') {
        return context.spaceActivity[area.id || '']?.latestActivityMs;
    }

    if (area.areaType === 'events') {
        // The event's start time, future or past. getAreaPreviewScore measures distance
        // from now in either direction, so imminence decays exactly like recency does.
        const startMs = area.scheduleStartAt ? new Date(area.scheduleStartAt).getTime() : NaN;
        return Number.isNaN(startMs) ? undefined : startMs;
    }

    const createdAtMs = new Date(area.createdAt).getTime();
    return Number.isNaN(createdAtMs) ? undefined : createdAtMs;
};

const getAreaEngagementCount = (area: IRankablePost, context: IAreaPreviewContext): number => {
    const base = (area.likeCount || 0) * 3 + getReplyCount(area) * 2 + (area.viewCount || 0) * 0.25;
    if (area.areaType === 'spaces') {
        return base + (context.spaceActivity[area.id || '']?.activityCount || 0) * 3;
    }
    return base;
};

/**
 * Blended proximity + recent-activity score for one preview card.
 * `distanceMeters` is passed in rather than derived so this stays a pure function of
 * numbers, and so the caller can reuse the distance it already computed.
 */
export const getAreaPreviewScore = (area: IRankablePost, distanceMeters: number, context: IAreaPreviewContext): number => {
    const proximity = Math.exp(-Math.max(distanceMeters, 0) / GEO_SCALE_METERS);

    const activityMs = getAreaActivityMs(area, context);
    // Absolute distance from now, so a future event decays with how far off it is. Clamping
    // to zero instead would give an event twenty days out the same recency as one starting
    // in an hour.
    const recency = activityMs == null
        ? 0
        : 1 / Math.pow(Math.abs(context.nowMs - activityMs) / MS_PER_HOUR + 2, RECENCY_GRAVITY);

    const engagement = Math.log1p(getAreaEngagementCount(area, context));
    const featured = area.featuredIncentiveRewardKey ? 1 : 0;

    return (AREA_WEIGHT_GEO * proximity)
        + (AREA_WEIGHT_RECENCY * recency)
        + (AREA_WEIGHT_ACTIVITY * engagement)
        + (AREA_WEIGHT_FEATURED * featured);
};

/**
 * Orders the preview strip by proximity blended with recent activity.
 *
 * Areas are expected to already carry `distanceFromPress`/`distanceFromUser` in miles
 * (as computed in TherrMapView.togglePreviewBottomSheet). Distance from the press point
 * drives the geo term, because the press is what the user is asking about.
 */
export const rankAreaPreviews = (areas: IRankablePost[], moments: IRankablePost[]): IRankablePost[] => {
    if (!areas?.length) {
        return areas;
    }

    const context: IAreaPreviewContext = {
        nowMs: Date.now(),
        spaceActivity: buildSpaceActivityMap(moments),
    };

    return areas
        .map((area) => ({
            area,
            score: getAreaPreviewScore(area, (area.distanceFromPress || 0) * METERS_PER_MILE, context),
        }))
        .sort((a, b) => (b.score - a.score)
            || ((a.area.distanceFromPress || 0) - (b.area.distanceFromPress || 0)))
        .map((scored) => scored.area);
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
