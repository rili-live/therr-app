// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import { getAlgorithmProfile } from 'therr-js-utilities/content-ranking';

import {
    applyAuthorDiversity,
    buildCategoryAffinityMap,
    getPostRankingScore,
    getReplyCount,
    getTopReply,
    rankFeedPosts,
    shouldAutoExpandThread,
} from '../../main/utilities/feedRanking';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

/**
 * Mirrors what rankFeedPosts builds internally, so getPostRankingScore can be exercised
 * directly. `algorithm` defaults to the profile every existing assertion here was written
 * against.
 */
const buildContext = (affinitySeed: any[] = [], algorithm = 'pulse') => {
    const categoryAffinity = buildCategoryAffinityMap(affinitySeed as any);
    const affinityCounts = Object.values(categoryAffinity);

    return {
        nowMs: Date.now(),
        categoryAffinity,
        profile: getAlgorithmProfile(algorithm),
        maxCategoryAffinity: affinityCounts.length ? Math.max(...affinityCounts) : 0,
    };
};

describe('feedRanking', () => {
    describe('getReplyCount', () => {
        it('prefers the server-provided replyCount over the capped preview array', () => {
            expect(getReplyCount({ id: '1', createdAt: hoursAgo(1), replyCount: 12, replies: [{}, {}, {}] } as any)).toBe(12);
        });

        it('falls back to replies length, then zero', () => {
            expect(getReplyCount({ id: '1', createdAt: hoursAgo(1), replies: [{}, {}] } as any)).toBe(2);
            expect(getReplyCount({ id: '1', createdAt: hoursAgo(1) } as any)).toBe(0);
        });
    });

    describe('rankFeedPosts', () => {
        it('ranks a highly engaged recent post above an unengaged newer post', () => {
            const engaged = {
                id: 'engaged', createdAt: hoursAgo(5), likeCount: 10, replyCount: 4,
            };
            const newer = {
                id: 'newer', createdAt: hoursAgo(1), likeCount: 0, replyCount: 0,
            };
            const ranked = rankFeedPosts([newer, engaged] as any);
            expect(ranked[0].id).toBe('engaged');
        });

        it('lets very stale engagement decay below fresh content', () => {
            const stale = {
                id: 'stale', createdAt: hoursAgo(24 * 14), likeCount: 5, replyCount: 2,
            };
            const fresh = {
                id: 'fresh', createdAt: hoursAgo(1), likeCount: 1, replyCount: 0,
            };
            const ranked = rankFeedPosts([stale, fresh] as any);
            expect(ranked[0].id).toBe('fresh');
        });

        it('boosts categories the user has liked (personalization)', () => {
            const context = buildContext([
                { id: 'liked', createdAt: hoursAgo(2), category: 'music', reaction: { userHasLiked: true } },
            ]);
            const musicPost = { id: 'a', createdAt: hoursAgo(3), category: 'music', likeCount: 1 };
            const otherPost = { id: 'b', createdAt: hoursAgo(3), category: 'food', likeCount: 1 };
            expect(getPostRankingScore(musicPost as any, context))
                .toBeGreaterThan(getPostRankingScore(otherPost as any, context));
        });

        it('handles empty input', () => {
            expect(rankFeedPosts([] as any)).toEqual([]);
        });
    });

    /**
     * The carousels used to rank with a fixed gravity regardless of the user's
     * settingsContentAlgorithm, so choosing Focus changed which posts the server activated but
     * not how the list the user scrolls was ordered.
     */
    describe('content algorithm awareness', () => {
        it('applies the profile\'s author cap under FOCUS', () => {
            const posts = [
                { id: '1', fromUserId: 'a', createdAt: hoursAgo(1), likeCount: 9 },
                { id: '2', fromUserId: 'a', createdAt: hoursAgo(2), likeCount: 8 },
                { id: '3', fromUserId: 'a', createdAt: hoursAgo(3), likeCount: 7 },
                { id: '4', fromUserId: 'b', createdAt: hoursAgo(4), likeCount: 1 },
            ];
            // FOCUS keeps 2 per author, so 'a' third post sinks below the other author's.
            const ranked = rankFeedPosts(posts as any, 'focus');
            const positionOfThirdA = ranked.findIndex((p) => p.id === '3');
            const positionOfB = ranked.findIndex((p) => p.id === '4');
            expect(positionOfThirdA).toBeGreaterThan(positionOfB);
        });

        it('leaves the page uncapped under PULSE, which is how it has always behaved', () => {
            const posts = [
                { id: '1', fromUserId: 'a', createdAt: hoursAgo(1), likeCount: 9 },
                { id: '2', fromUserId: 'a', createdAt: hoursAgo(2), likeCount: 8 },
                { id: '3', fromUserId: 'b', createdAt: hoursAgo(3), likeCount: 1 },
            ];
            const ranked = rankFeedPosts(posts as any, 'pulse');
            // No cap to enforce and no 3-run to break up, so score order survives intact.
            expect(ranked.map((p) => p.id)).toEqual(['1', '2', '3']);
        });

        it('weights declared interests far higher under FOCUS than under PULSE', () => {
            // Same page, same ages, same engagement — only the category affinity differs.
            const posts = [
                { id: 'offInterest', createdAt: hoursAgo(1), category: 'food', likeCount: 4 },
                { id: 'onInterest', createdAt: hoursAgo(6), category: 'music', likeCount: 0 },
                { id: 'seed', createdAt: hoursAgo(2), category: 'music', reaction: { userHasLiked: true } },
            ];

            // Under FOCUS the interest term carries weight 1.0 against hotness at 0.3, so the
            // older on-interest post outranks the fresher off-interest one.
            const focused = rankFeedPosts(posts as any, 'focus');
            expect(focused.findIndex((p) => p.id === 'onInterest'))
                .toBeLessThan(focused.findIndex((p) => p.id === 'offInterest'));

            // Under PULSE the interest weight is 0, so recency and engagement win instead.
            const pulsed = rankFeedPosts(posts as any, 'pulse');
            expect(pulsed.findIndex((p) => p.id === 'offInterest'))
                .toBeLessThan(pulsed.findIndex((p) => p.id === 'onInterest'));
        });

        it('degrades an unrecognized or missing algorithm to the default rather than throwing', () => {
            const posts = [
                { id: 'a', createdAt: hoursAgo(1), likeCount: 2 },
                { id: 'b', createdAt: hoursAgo(9), likeCount: 0 },
            ];
            const expected = rankFeedPosts(posts as any, 'pulse').map((p) => p.id);

            // A stale persisted redux value, an algorithm this build predates, and no value.
            expect(rankFeedPosts(posts as any, 'not-a-real-algorithm').map((p) => p.id)).toEqual(expected);
            expect(rankFeedPosts(posts as any).map((p) => p.id)).toEqual(expected);
        });
    });

    describe('applyAuthorDiversity', () => {
        it('breaks up runs of 3+ consecutive posts from the same author', () => {
            const posts = [
                { id: '1', fromUserId: 'a' },
                { id: '2', fromUserId: 'a' },
                { id: '3', fromUserId: 'a' },
                { id: '4', fromUserId: 'b' },
            ];
            const result = applyAuthorDiversity(posts as any);
            expect(result.map((p) => p.id)).toEqual(['1', '2', '4', '3']);
        });

        it('leaves the list unchanged when no author dominates', () => {
            const posts = [
                { id: '1', fromUserId: 'a' },
                { id: '2', fromUserId: 'b' },
                { id: '3', fromUserId: 'a' },
            ];
            expect(applyAuthorDiversity(posts as any).map((p) => p.id)).toEqual(['1', '2', '3']);
        });
    });

    describe('getTopReply', () => {
        it('picks the most liked reply, then the most recent', () => {
            const thought = {
                id: 't',
                createdAt: hoursAgo(4),
                replies: [
                    { id: 'r1', message: 'old popular', likeCount: 3, createdAt: hoursAgo(3) },
                    { id: 'r2', message: 'new', likeCount: 0, createdAt: hoursAgo(1) },
                ],
            };
            expect(getTopReply(thought as any)?.id).toBe('r1');
        });

        it('skips replies with no message and handles missing replies', () => {
            const thought = {
                id: 't',
                createdAt: hoursAgo(4),
                replies: [{ id: 'r1', likeCount: 5, createdAt: hoursAgo(1) }],
            };
            expect(getTopReply(thought as any)).toBeUndefined();
            expect(getTopReply({ id: 't', createdAt: hoursAgo(4) } as any)).toBeUndefined();
        });
    });

    describe('shouldAutoExpandThread', () => {
        const reply = (likeCount = 0) => ({
            id: 'r', message: 'hi', likeCount, createdAt: hoursAgo(1),
        });

        it('always expands threads with 2+ replies', () => {
            const thought = {
                id: 't', createdAt: hoursAgo(2), replyCount: 2, replies: [reply(), reply()],
            };
            expect(shouldAutoExpandThread(thought as any)).toBe(true);
        });

        it('expands single-reply threads only with a like signal', () => {
            const unliked = {
                id: 't', createdAt: hoursAgo(2), replyCount: 1, likeCount: 0, replies: [reply(0)],
            };
            const likedParent = {
                id: 't', createdAt: hoursAgo(2), replyCount: 1, likeCount: 1, replies: [reply(0)],
            };
            const likedReply = {
                id: 't', createdAt: hoursAgo(2), replyCount: 1, likeCount: 0, replies: [reply(2)],
            };
            expect(shouldAutoExpandThread(unliked as any)).toBe(false);
            expect(shouldAutoExpandThread(likedParent as any)).toBe(true);
            expect(shouldAutoExpandThread(likedReply as any)).toBe(true);
        });

        it('never expands areas, drafts, or reply-less thoughts', () => {
            expect(shouldAutoExpandThread({ id: 't', createdAt: hoursAgo(1), areaType: 'moments', replies: [reply()] } as any)).toBe(false);
            expect(shouldAutoExpandThread({ id: 't', createdAt: hoursAgo(1), isDraft: true, replies: [reply()] } as any)).toBe(false);
            expect(shouldAutoExpandThread({ id: 't', createdAt: hoursAgo(1) } as any)).toBe(false);
        });
    });
});
