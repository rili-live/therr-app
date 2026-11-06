import { IPactChatItem, IPactChatUser } from 'therr-react/types';

/**
 * Pure helpers behind the pact chat screen (PactChat.tsx). Kept out of the component so the
 * merge, reaction and naming rules can be pinned without rendering anything. Server contract:
 * docs/niche-sub-apps/habits/HABITS_PACT_CHAT_DESIGN.md.
 */

/** How often an open chat asks for new items. Only while the screen has focus. */
export const PACT_CHAT_POLL_INTERVAL_MS = 10 * 1000;

/** Mirrors the server's MAX_MESSAGE_LENGTH so the composer can stop the user before the 400. */
export const PACT_CHAT_MAX_MESSAGE_LENGTH = 1000;

/** Shown until the server's `reactionOptions` arrives; must match handlers/pactChat.ts. */
export const DEFAULT_REACTION_OPTIONS = ['💪', '🔥', '👏', '❤️', '😂', '🙌'];

/** Locale keys of the one-tap replies above the composer. Each sends its translated text. */
export const QUICK_REPLY_KEYS = [
    'pages.pactChat.quickReplies.flex',
    'pages.pactChat.quickReplies.nice',
    'pages.pactChat.quickReplies.letsGo',
    'pages.pactChat.quickReplies.proud',
];

/** A message the viewer sent that the server has not confirmed yet (or that failed). */
export interface IPendingChatItem extends IPactChatItem {
    clientMessageId: string;
    sendState: 'sending' | 'failed';
}

export type IChatListItem = IPactChatItem | IPendingChatItem;

export const isPendingItem = (item: IChatListItem): item is IPendingChatItem => (
    (item as IPendingChatItem).sendState !== undefined
);

/**
 * Merges a page into what is on screen: dedupes by id (a poll and a send can both deliver the
 * same message), lets the newer copy win (it carries fresher reactions), and keeps the list
 * newest first, which is what the inverted FlatList renders bottom-up.
 */
export const mergeChatItems = (current: IChatListItem[], incoming: IChatListItem[]): IChatListItem[] => {
    const byId = new Map<string, IChatListItem>();
    current.forEach((item) => byId.set(item.id, item));
    incoming.forEach((item) => byId.set(item.id, item));
    return Array.from(byId.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/**
 * Replaces the optimistic copy of a sent message with the server's. Matched by
 * clientMessageId, since the server id is not known until the response.
 */
export const confirmPendingItem = (
    items: IChatListItem[],
    clientMessageId: string,
    confirmed: IPactChatItem,
): IChatListItem[] => mergeChatItems(
    items.filter((item) => !(isPendingItem(item) && item.clientMessageId === clientMessageId)),
    [confirmed],
);

/** The newest confirmed item's timestamp: the `after` cursor for polling. */
export const getNewestConfirmedAt = (items: IChatListItem[]): string | undefined => (
    items.find((item) => !isPendingItem(item))?.createdAt
);

/** The oldest confirmed item's timestamp: the `before` cursor for scrolling back. */
export const getOldestConfirmedAt = (items: IChatListItem[]): string | undefined => {
    const confirmed = items.filter((item) => !isPendingItem(item));
    return confirmed.length ? confirmed[confirmed.length - 1].createdAt : undefined;
};

export interface IReactionSummary {
    emoji: string;
    count: number;
    isMine: boolean;
}

/** Groups an item's reactions into chips, in first-reacted order, marking the viewer's own. */
export const summarizeReactions = (
    reactions: { userId: string; emoji: string }[] | undefined,
    viewerUserId: string,
): IReactionSummary[] => {
    const summaries: IReactionSummary[] = [];
    (reactions || []).forEach((reaction) => {
        const existing = summaries.find((summary) => summary.emoji === reaction.emoji);
        if (existing) {
            existing.count += 1;
            existing.isMine = existing.isMine || reaction.userId === viewerUserId;
        } else {
            summaries.push({ emoji: reaction.emoji, count: 1, isMine: reaction.userId === viewerUserId });
        }
    });
    return summaries;
};

export const getMyReaction = (
    reactions: { userId: string; emoji: string }[] | undefined,
    viewerUserId: string,
): string | null => (reactions || []).find((reaction) => reaction.userId === viewerUserId)?.emoji || null;

/** Tapping the emoji you already chose clears it; any other emoji replaces it. One each, server-enforced. */
export const getNextReaction = (current: string | null, tapped: string): string | null => (
    current === tapped ? null : tapped
);

/** Applies the viewer's reaction locally, so the chip moves before the server answers. */
export const applyMyReaction = (
    reactions: { userId: string; emoji: string }[] | undefined,
    viewerUserId: string,
    emoji: string | null,
): { userId: string; emoji: string }[] => {
    const others = (reactions || []).filter((reaction) => reaction.userId !== viewerUserId);
    return emoji ? [...others, { userId: viewerUserId, emoji }] : others;
};

/** First name, then handle, then the caller's fallback — the same order the pact screens use. */
export const getAuthorName = (
    users: Record<string, IPactChatUser> | undefined,
    userId: string,
    fallback: string,
): string => {
    const user = users?.[userId];
    return user?.firstName || user?.userName || fallback;
};

/**
 * Whether to draw the author's name above a bubble: only on the first of a run of consecutive
 * messages from the same person. `items` is newest first, so the *older* neighbour is index + 1.
 */
export const isFirstOfRun = (items: IChatListItem[], index: number): boolean => {
    const older = items[index + 1];
    const item = items[index];
    return !older || older.kind !== 'message' || older.userId !== item.userId;
};

/**
 * An RFC 4122 v4-shaped id for idempotent sends. Not cryptographic, and does not need to be: it
 * only has to be unique per sender, since the server's UNIQUE is (userId, clientMessageId).
 */
export const generateClientMessageId = (random: () => number = Math.random): string => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    .replace(/[xy]/g, (char) => {
        const value = Math.floor(random() * 16);
        return (char === 'x' ? value : ((value % 4) + 8)).toString(16);
    });

/** "3:41 PM" today, "Oct 27" earlier — chat-scale timestamps. */
export const formatChatTime = (iso: string, locale: string, now: Date = new Date()): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const sameDay = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
    try {
        return sameDay
            ? date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
            : date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    } catch {
        return sameDay ? `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}` : date.toDateString();
    }
};

/** Bounded so a badge never grows wider than the card it sits on. */
export const formatUnreadCount = (count: number | undefined): string | null => {
    if (!count || count <= 0) {
        return null;
    }
    return count > 9 ? '9+' : String(count);
};
