import {
    applyMyReaction,
    confirmPendingItem,
    formatUnreadCount,
    generateClientMessageId,
    getAuthorName,
    getMyReaction,
    getNewestConfirmedAt,
    getNextReaction,
    getOldestConfirmedAt,
    IChatListItem,
    IPendingChatItem,
    isFirstOfRun,
    mergeChatItems,
    summarizeReactions,
} from '../../main/routes/Pacts/pactChatState';

const ME = 'user-me';
const PAT = 'user-pat';

const message = (id: string, createdAt: string, userId = PAT, overrides: any = {}): IChatListItem => ({
    id, kind: 'message', pactId: 'pact-1', userId, createdAt, text: id, reactions: [], ...overrides,
});

const pending = (clientMessageId: string, createdAt: string, sendState: 'sending' | 'failed' = 'sending'): IPendingChatItem => ({
    id: `pending-${clientMessageId}`,
    kind: 'message',
    pactId: 'pact-1',
    userId: ME,
    createdAt,
    text: 'hi',
    reactions: [],
    clientMessageId,
    sendState,
});

describe('pact chat state', () => {
    describe('mergeChatItems', () => {
        it('keeps the list newest first and dedupes a message a poll and a send both delivered', () => {
            const merged = mergeChatItems(
                [message('m1', '2026-10-29T10:00:00.000Z'), message('m2', '2026-10-29T11:00:00.000Z')],
                [message('m2', '2026-10-29T11:00:00.000Z', PAT, { reactions: [{ userId: ME, emoji: '💪' }] }),
                    message('m3', '2026-10-29T12:00:00.000Z')],
            );

            expect(merged.map((item) => item.id)).toEqual(['m3', 'm2', 'm1']);
            // The incoming copy wins: it carries the fresher reactions.
            expect(merged[1].reactions).toEqual([{ userId: ME, emoji: '💪' }]);
        });
    });

    describe('confirmPendingItem', () => {
        it('swaps the optimistic copy for the server row, matched by clientMessageId', () => {
            const items = mergeChatItems([], [pending('c1', '2026-10-29T12:00:00.000Z'), message('m1', '2026-10-29T10:00:00.000Z')]);
            const confirmed = message('server-id', '2026-10-29T12:00:01.000Z', ME);

            const next = confirmPendingItem(items, 'c1', confirmed as any);

            expect(next.map((item) => item.id)).toEqual(['server-id', 'm1']);
        });
    });

    describe('cursors', () => {
        it('ignore unconfirmed sends, which the server has never seen', () => {
            const items = mergeChatItems([], [
                pending('c1', '2026-10-29T13:00:00.000Z', 'failed'),
                message('m2', '2026-10-29T11:00:00.000Z'),
                message('m1', '2026-10-29T10:00:00.000Z'),
            ]);

            expect(getNewestConfirmedAt(items)).toBe('2026-10-29T11:00:00.000Z');
            expect(getOldestConfirmedAt(items)).toBe('2026-10-29T10:00:00.000Z');
            expect(getNewestConfirmedAt([])).toBeUndefined();
        });
    });

    describe('reactions', () => {
        const reactions = [
            { userId: PAT, emoji: '💪' },
            { userId: 'user-sam', emoji: '💪' },
            { userId: ME, emoji: '🔥' },
        ];

        it('groups into chips in first-reacted order and marks the viewer’s own', () => {
            expect(summarizeReactions(reactions, ME)).toEqual([
                { emoji: '💪', count: 2, isMine: false },
                { emoji: '🔥', count: 1, isMine: true },
            ]);
        });

        it('tapping your own emoji clears it; another one replaces it (one each)', () => {
            expect(getMyReaction(reactions, ME)).toBe('🔥');
            expect(getNextReaction('🔥', '🔥')).toBeNull();
            expect(getNextReaction('🔥', '💪')).toBe('💪');
            expect(getNextReaction(null, '💪')).toBe('💪');
        });

        it('applies the viewer’s reaction locally without touching anyone else’s', () => {
            expect(applyMyReaction(reactions, ME, '💪')).toEqual([
                { userId: PAT, emoji: '💪' },
                { userId: 'user-sam', emoji: '💪' },
                { userId: ME, emoji: '💪' },
            ]);
            expect(applyMyReaction(reactions, ME, null)).toHaveLength(2);
        });
    });

    describe('getAuthorName', () => {
        it('prefers first name, then handle, then the fallback', () => {
            const users = { [PAT]: { id: PAT, firstName: 'Pat', userName: 'pat_runs' }, sam: { id: 'sam', userName: 'sam' } };
            expect(getAuthorName(users, PAT, 'Your partner')).toBe('Pat');
            expect(getAuthorName(users, 'sam', 'Your partner')).toBe('sam');
            expect(getAuthorName(users, 'gone', 'Your partner')).toBe('Your partner');
        });
    });

    describe('isFirstOfRun', () => {
        it('names the author only above the oldest of consecutive messages from one person', () => {
            // Newest first, as the inverted list holds them.
            const items = [
                message('m3', '2026-10-29T12:00:00.000Z', PAT),
                message('m2', '2026-10-29T11:00:00.000Z', PAT),
                message('m1', '2026-10-29T10:00:00.000Z', ME),
            ];

            expect(isFirstOfRun(items, 0)).toBe(false);
            expect(isFirstOfRun(items, 1)).toBe(true);
            expect(isFirstOfRun(items, 2)).toBe(true);
        });
    });

    it('generates v4-shaped client message ids', () => {
        expect(generateClientMessageId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(generateClientMessageId()).not.toBe(generateClientMessageId());
    });

    it('caps the unread badge and hides it at zero or when the server has no chat', () => {
        expect(formatUnreadCount(undefined)).toBeNull();
        expect(formatUnreadCount(0)).toBeNull();
        expect(formatUnreadCount(3)).toBe('3');
        expect(formatUnreadCount(14)).toBe('9+');
    });
});
