/**
 * Selection rules for the inline thread previews rendered under a post in the web feed.
 *
 * These mirror the mobile implementation in `TherrMobile/main/utilities/feedRanking.ts`
 * so a thread that auto-expands on mobile also auto-expands on web. Only the preview
 * selection is shared; mobile's client-side feed ranking is not ported, because the web
 * stream is already relevance-ordered server-side by reactions-service
 * (`searchActiveThoughts` orders reactions by `relevance`) and is paginated rather than
 * a carousel over one cached page.
 *
 * Keep the two in sync: if the auto-expand criteria change on one platform, change both.
 */

export interface IThreadPreviewPost {
    id?: string;
    createdAt?: string | Date;
    likeCount?: number;
    replyCount?: number;
    replies?: any[];
    areaType?: string;
    isDraft?: boolean;
    [key: string]: any;
}

/**
 * The true reply total. Prefer the server-provided `replyCount` — `replies` is capped at
 * a few preview rows by the lateral join in `ThoughtsStore.find`, so its length
 * under-reports any thread with more than that.
 */
export const getReplyCount = (post: IThreadPreviewPost): number => {
    if (post?.replyCount != null) {
        return post.replyCount;
    }

    return post?.replies?.length || 0;
};

/**
 * The reply surfaced in an auto-expanded thread preview: most liked, then most recent.
 */
export const getTopReply = (post: IThreadPreviewPost): any | undefined => {
    if (!post?.replies?.length) {
        return undefined;
    }

    return [...post.replies]
        .filter((reply) => !!reply?.message)
        .sort((a, b) => ((b.likeCount || 0) - (a.likeCount || 0))
            || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))[0];
};

/**
 * Translation key for the reply control under a post, given its reply total.
 *
 * A post with no replies must not be labelled "View 0 replies" — that string is the
 * control's tooltip *and* its aria-label, and on an empty thread the control opens
 * the thread to write the first reply rather than to view anything.
 */
export const getRepliesLabelKey = (replyCount: number): string => {
    if (!replyCount || replyCount < 1) {
        return 'pages.exploreThoughts.reply';
    }

    if (replyCount === 1) {
        return 'pages.exploreThoughts.viewReply';
    }

    return 'pages.exploreThoughts.viewReplies';
};

/**
 * Auto-expand criteria: threads with real conversation (2+ replies) always expand;
 * single-reply threads only expand when there is a like signal on the parent or reply.
 */
export const shouldAutoExpandThread = (post: IThreadPreviewPost): boolean => {
    if (!post || post.areaType || post.isDraft) {
        return false;
    }

    const topReply = getTopReply(post);
    if (!topReply) {
        return false;
    }

    if (getReplyCount(post) >= 2) {
        return true;
    }

    return (post.likeCount || 0) >= 1 || (topReply.likeCount || 0) >= 1;
};
