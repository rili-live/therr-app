/**
 * @jest-environment jsdom
 */
import {
    getRepliesLabelKey, getReplyCount, getTopReply, shouldAutoExpandThread,
} from '../threadPreview';

const reply = (overrides: any = {}) => ({
    id: 'reply-1',
    message: 'a reply',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
});

describe('getReplyCount', () => {
    it('prefers the server-provided replyCount over the capped preview array', () => {
        expect(getReplyCount({ replyCount: 42, replies: [reply(), reply()] })).toBe(42);
    });

    it('falls back to the preview array length when replyCount is absent', () => {
        expect(getReplyCount({ replies: [reply(), reply()] })).toBe(2);
    });

    it('returns a replyCount of 0 rather than falling through to the array', () => {
        expect(getReplyCount({ replyCount: 0, replies: [reply()] })).toBe(0);
    });

    it('returns 0 when there are no replies at all', () => {
        expect(getReplyCount({})).toBe(0);
    });
});

describe('getTopReply', () => {
    it('returns undefined when there are no replies', () => {
        expect(getTopReply({})).toBeUndefined();
        expect(getTopReply({ replies: [] })).toBeUndefined();
    });

    it('picks the most liked reply', () => {
        const top = getTopReply({
            replies: [
                reply({ id: 'a', likeCount: 1 }),
                reply({ id: 'b', likeCount: 9 }),
                reply({ id: 'c', likeCount: 4 }),
            ],
        });

        expect(top.id).toBe('b');
    });

    it('breaks ties on likes by recency', () => {
        const top = getTopReply({
            replies: [
                reply({ id: 'older', likeCount: 2, createdAt: '2026-07-01T00:00:00.000Z' }),
                reply({ id: 'newer', likeCount: 2, createdAt: '2026-07-20T00:00:00.000Z' }),
            ],
        });

        expect(top.id).toBe('newer');
    });

    it('skips replies with no message so an empty card is never previewed', () => {
        const top = getTopReply({
            replies: [
                reply({ id: 'empty', message: '', likeCount: 99 }),
                reply({ id: 'real', likeCount: 1 }),
            ],
        });

        expect(top.id).toBe('real');
    });

    it('does not mutate the source replies array', () => {
        const replies = [reply({ id: 'a', likeCount: 1 }), reply({ id: 'b', likeCount: 9 })];
        getTopReply({ replies });

        expect(replies.map((r) => r.id)).toEqual(['a', 'b']);
    });
});

describe('getRepliesLabelKey', () => {
    // Regression: the label is the control's tooltip *and* its aria-label, so a
    // zero-reply post used to announce itself to screen readers as "View 0 replies".
    it('labels a post with no replies as an invitation to reply', () => {
        expect(getRepliesLabelKey(0)).toBe('pages.exploreThoughts.reply');
    });

    it('uses the singular key for exactly one reply', () => {
        expect(getRepliesLabelKey(1)).toBe('pages.exploreThoughts.viewReply');
    });

    it('uses the counted plural key for two or more replies', () => {
        expect(getRepliesLabelKey(2)).toBe('pages.exploreThoughts.viewReplies');
        expect(getRepliesLabelKey(42)).toBe('pages.exploreThoughts.viewReplies');
    });

    it('never renders a count for a missing or nonsensical total', () => {
        expect(getRepliesLabelKey(undefined as any)).toBe('pages.exploreThoughts.reply');
        expect(getRepliesLabelKey(NaN)).toBe('pages.exploreThoughts.reply');
        expect(getRepliesLabelKey(-1)).toBe('pages.exploreThoughts.reply');
    });
});

describe('shouldAutoExpandThread', () => {
    it('expands any thread with 2+ replies', () => {
        expect(shouldAutoExpandThread({
            replyCount: 2,
            replies: [reply({ id: 'a' }), reply({ id: 'b' })],
        })).toBe(true);
    });

    it('expands a thread whose true replyCount is 2+ even when only one preview row came back', () => {
        expect(shouldAutoExpandThread({ replyCount: 7, replies: [reply()] })).toBe(true);
    });

    it('does not expand a single-reply thread with no like signal', () => {
        expect(shouldAutoExpandThread({ replyCount: 1, replies: [reply()] })).toBe(false);
    });

    it('expands a single-reply thread when the parent has a like', () => {
        expect(shouldAutoExpandThread({ likeCount: 1, replyCount: 1, replies: [reply()] })).toBe(true);
    });

    it('expands a single-reply thread when the reply has a like', () => {
        expect(shouldAutoExpandThread({
            replyCount: 1,
            replies: [reply({ likeCount: 3 })],
        })).toBe(true);
    });

    it('never expands a thread with no replies', () => {
        expect(shouldAutoExpandThread({ likeCount: 10 })).toBe(false);
    });

    it('never expands drafts or map areas', () => {
        const replies = [reply({ id: 'a' }), reply({ id: 'b' })];

        expect(shouldAutoExpandThread({ isDraft: true, replyCount: 2, replies })).toBe(false);
        expect(shouldAutoExpandThread({ areaType: 'moments', replyCount: 2, replies })).toBe(false);
    });

    it('handles a null post', () => {
        expect(shouldAutoExpandThread(null as any)).toBe(false);
    });
});
