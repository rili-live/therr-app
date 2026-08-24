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
 * The feed curve itself now comes from the user's selected content algorithm
 * (`settingsContentAlgorithm`) via therr-js-utilities `content-ranking`, which is the same
 * module users-service ThoughtsStore.getRecentThoughts ranks stream activation with. Before
 * this, the carousels applied their own fixed gravity regardless of the setting, so picking
 * Focus visibly changed which posts got activated but not how the list the user actually
 * scrolls was ordered. See docs/ALGORITHM_AUDIT.md.
 *
 * What stays local is what the server has no data for: this file decides what counts as
 * engagement (likes/replies/views, log-dampened) and derives an interest signal from the
 * user's own reactions in the cached page. The profile decides how those are weighed. The
 * map preview strip is the exception — it keeps its own blend and its own gravity, because
 * no server profile models "a persistent space next to a minutes-old moment".
 */
import {
    IAlgorithmProfile,
    IScoreComponents,
    applyAuthorDiversity as capPerAuthor,
    getAlgorithmProfile,
    rankByScore,
    scoreContent,
} from 'therr-js-utilities/content-ranking';
// From the leaf module, not the `constants` barrel: that barrel imports Notifee at module
// load, which this file must not drag into a pure ranking utility (or its unit tests).
import { METERS_PER_MILE } from '../constants/units';

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
// Recency decay for the preview strip. Deliberately local rather than read off the selected
// algorithm profile: the profiles' gravities are tuned for a multiplicative engagement-over-age
// hot score, and this strip is an additive blend whose recency term is a standalone 0..1 factor.
const AREA_RECENCY_GRAVITY = 1.1;

const AREA_WEIGHT_GEO = 1;
const AREA_WEIGHT_RECENCY = 0.8;
const AREA_WEIGHT_ACTIVITY = 0.5;
const AREA_WEIGHT_FEATURED = 0.2;

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
        : 1 / Math.pow(Math.abs(context.nowMs - activityMs) / MS_PER_HOUR + 2, AREA_RECENCY_GRAVITY);

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
