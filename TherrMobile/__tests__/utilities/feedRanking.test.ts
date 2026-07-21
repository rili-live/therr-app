// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

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
            const context = {
                nowMs: Date.now(),
                categoryAffinity: buildCategoryAffinityMap([
                    { id: 'liked', createdAt: hoursAgo(2), category: 'music', reaction: { userHasLiked: true } },
                ] as any),
            };
            const musicPost = { id: 'a', createdAt: hoursAgo(3), category: 'music', likeCount: 1 };
            const otherPost = { id: 'b', createdAt: hoursAgo(3), category: 'food', likeCount: 1 };
            expect(getPostRankingScore(musicPost as any, context))
                .toBeGreaterThan(getPostRankingScore(otherPost as any, context));
        });

        it('handles empty input', () => {
            expect(rankFeedPosts([] as any)).toEqual([]);
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
