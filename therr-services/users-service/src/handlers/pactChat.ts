import { RequestHandler } from 'express';
import { BrandVariations, ErrorCodes, PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import enqueueNotification from '../utilities/enqueueNotification';
import { resolveHabitDisplayName, resolveUserDisplayName } from '../utilities/notificationNames';
import { isUserInPact } from '../utilities/pactHelpers';
import {
    IPactChatCheckinRow,
    IPactChatReactionRow,
    IPactMessageRow,
    PactChatTargetKind,
} from '../store/PactChatStore';

/**
 * Pact chat — one thread per pact (and its renewal chain): members' messages with their
 * completed check-ins inline, emoji reactions, a per-pact mute and a report path.
 * See docs/niche-sub-apps/habits/HABITS_PACT_CHAT_DESIGN.md.
 */

export const MAX_MESSAGE_LENGTH = 1000;
export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 50;
/** The curated reaction set. A closed list keeps the column honest and the UI a single row. */
export const PACT_CHAT_REACTIONS = ['💪', '🔥', '👏', '❤️', '😂', '🙌'];
/**
 * How long a chat push waits before it may go out. Long enough that a partner who is already
 * in the thread (polling every 10s) reads the message first and the send-time freshness check
 * (utilities/pactMessageFreshness.ts) skips the push; short enough to still feel live.
 */
export const PACT_MESSAGE_PUSH_DELAY_MS = 90 * 1000;
const PREVIEW_LENGTH = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Members who can still read the thread: everyone carrying the pact, and those who finished it. */
const READABLE_MEMBER_STATUSES = ['active', 'completed'];

/**
 * The dedupe key for one recipient's chat push: the pact plus the UTC hour the message was
 * written in, from the stored row — never the clock. The queue's UNIQUE (brand, user, key)
 * then holds each recipient to one chat push per pact per hour however many messages arrive.
 *
 * The recipient's read watermark is part of the key. A row the freshness gate skips as
 * `already-read` still occupies its key, so without the watermark a partner who read the
 * hour's first message in the thread and then left the app was not notified of anything else
 * that hour. Reading moves the watermark, which opens a new key for the next message; while
 * they have read nothing new, a burst still shares one key and one push.
 */
export const buildPactMessageDedupeKey = (
    pactId: string,
    messageCreatedAt: Date | string,
    recipientLastReadAt?: Date | string | null,
): string => {
    const key = `pact-message:${pactId}:${new Date(messageCreatedAt).toISOString().slice(0, 13)}`;
    const readAt = recipientLastReadAt ? new Date(recipientLastReadAt) : undefined;
    return readAt && !Number.isNaN(readAt.getTime()) ? `${key}:read-${readAt.toISOString()}` : key;
};

export const buildMessagePreview = (text: string): string => {
    const firstLine = String(text || '').split('\n').map((line) => line.trim()).find(Boolean) || '';
    return firstLine.length > PREVIEW_LENGTH ? `${firstLine.slice(0, PREVIEW_LENGTH - 1)}…` : firstLine;
};

const parseDate = (value: unknown): Date | undefined => {
    if (typeof value !== 'string' || !value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
};

interface IChatAccess {
    pact: any;
    member: any;
    canRead: boolean;
    canPost: boolean;
}

/**
 * Who may do what. Read: a member who is carrying or finished the pact (pending invitees, and
 * members who left or were removed, may not). Legacy 1:1 pacts with no member rows fall back to
 * the creator/partner columns. Post and react: the pact is running and the caller is in it.
 */
export const resolveChatAccess = (pact: any, member: any, userId: string): Pick<IChatAccess, 'canRead' | 'canPost'> => {
    if (!pact) {
        return { canRead: false, canPost: false };
    }
    const isLegacyParticipant = !member && isUserInPact(userId, pact.creatorUserId, pact.partnerUserId);
    const canRead = isLegacyParticipant || READABLE_MEMBER_STATUSES.includes(member?.status);
    const isActiveParticipant = isLegacyParticipant || member?.status === 'active';
    return {
        canRead,
        canPost: canRead && isActiveParticipant && pact.status === 'active',
    };
};

/**
 * Loads the pact and the caller's membership, and answers the request itself (404/403) when the
 * caller may not proceed. Returns undefined when it has answered.
 */
const loadAccess = async (req: any, res: any, pactId: string, requirePost = false): Promise<IChatAccess | undefined> => {
    const { locale, userId } = parseHeaders(req.headers);

    if (!UUID_PATTERN.test(String(pactId || ''))) {
        handleHttpError({
            res, message: translate(locale, 'errorMessages.pacts.notFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
        });
        return undefined;
    }

    const [pact, member] = await Promise.all([
        Store.pacts.getById(pactId),
        Store.pactMembers.getByPactAndUser(pactId, userId),
    ]);

    if (!pact) {
        handleHttpError({
            res, message: translate(locale, 'errorMessages.pacts.notFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
        });
        return undefined;
    }

    const { canRead, canPost } = resolveChatAccess(pact, member, userId);
    if (!canRead || (requirePost && !canPost)) {
        handleHttpError({
            res,
            message: translate(locale, canRead ? 'errorMessages.pactChat.notActive' : 'errorMessages.pacts.notParticipant'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
        return undefined;
    }

    return {
        pact, member, canRead, canPost,
    };
};

const getBlockedUserIds = async (userId: string): Promise<string[]> => {
    const rows = await Store.users.findUser({ id: userId }, ['blockedUsers']).catch(() => []);
    const blocked = rows?.[0]?.blockedUsers;
    return Array.isArray(blocked) ? blocked.filter((id: unknown): id is string => typeof id === 'string') : [];
};

export interface IPactChatItem {
    id: string;
    kind: PactChatTargetKind;
    pactId: string;
    userId: string;
    createdAt: string;
    text?: string;
    checkin?: {
        habitGoalId: string;
        habitGoalName?: string | null;
        habitGoalEmoji?: string | null;
        notes?: string | null;
        hasProof: boolean;
    };
    reactions: { userId: string; emoji: string }[];
}

const toIso = (value: Date | string): string => new Date(value).toISOString();

export const messageToItem = (row: IPactMessageRow): IPactChatItem => ({
    id: row.id,
    kind: 'message',
    pactId: row.pactId,
    userId: row.userId,
    createdAt: toIso(row.createdAt),
    text: row.text,
    reactions: [],
});

export const checkinToItem = (row: IPactChatCheckinRow): IPactChatItem => ({
    id: row.id,
    kind: 'checkin',
    pactId: row.pactId,
    userId: row.userId,
    createdAt: toIso(row.occurredAt),
    checkin: {
        habitGoalId: row.habitGoalId,
        habitGoalName: row.habitGoalName,
        habitGoalEmoji: row.habitGoalEmoji,
        notes: row.notes,
        hasProof: !!row.hasProof,
    },
    reactions: [],
});

/**
 * Merges the two sources into one page, newest first, and says whether there is more. Each
 * source was read `limit` deep from the same cursor, so the first `limit` of the merge are
 * exactly the page; there is more if anything was cut or either source filled its read.
 */
export const mergeTimeline = (
    messages: IPactMessageRow[],
    checkins: IPactChatCheckinRow[],
    reactions: IPactChatReactionRow[],
    limit: number,
    { isPolling = false }: { isPolling?: boolean } = {},
): { items: IPactChatItem[]; hasMore: boolean } => {
    const merged = [...messages.map(messageToItem), ...checkins.map(checkinToItem)];
    // Polling reads forwards, so the page is the *oldest* `limit` new items; the client
    // polls again for the rest. Scrolling back takes the newest `limit` before the cursor.
    merged.sort((a, b) => (isPolling
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt)));
    const page = merged.slice(0, limit);
    const hasMore = merged.length > limit || messages.length >= limit || checkins.length >= limit;

    const reactionsByTarget = reactions.reduce((acc: Record<string, { userId: string; emoji: string }[]>, reaction) => {
        acc[reaction.targetId] = acc[reaction.targetId] || [];
        acc[reaction.targetId].push({ userId: reaction.userId, emoji: reaction.emoji });
        return acc;
    }, {});

    const items = page.map((item) => ({ ...item, reactions: reactionsByTarget[item.id] || [] }));
    // Always returned newest first, whichever way it was read.
    if (isPolling) items.reverse();
    return { items, hasMore };
};

// READ
const getPactChat: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { pactId } = req.params;

    try {
        const access = await loadAccess(req, res, pactId);
        if (!access) return undefined;

        const before = parseDate(req.query.before);
        const after = parseDate(req.query.after);
        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Math.min(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const window = { before: after ? undefined : before, after, limit };

        const [threadPactIds, blockedUserIds] = await Promise.all([
            Store.pactChat.getThreadPactIds(pactId),
            getBlockedUserIds(userId),
        ]);

        const [messages, checkins] = await Promise.all([
            Store.pactChat.getMessages(threadPactIds, window, { viewerUserId: userId, excludeAuthorIds: blockedUserIds }),
            Store.pactChat.getCompletedCheckins(threadPactIds, window),
        ]);
        const visibleCheckins = checkins.filter((checkin) => !blockedUserIds.includes(checkin.userId));

        const itemIds = [...messages.map((m) => m.id), ...visibleCheckins.map((c) => c.id)];
        const reactions = await Store.pactChat.getReactions(itemIds);
        const { items, hasMore } = mergeTimeline(messages, visibleCheckins, reactions, limit, { isPolling: !!after });

        const authorIds = Array.from(new Set([
            ...items.map((item) => item.userId),
            ...reactions.map((reaction) => reaction.userId),
        ]));
        const authors = authorIds.length
            ? await Store.users.findUsers({ ids: authorIds }, ['id', 'userName', 'firstName', 'lastName', 'media'])
            : [];

        return res.status(200).send({
            pactId,
            items,
            users: authors.reduce((acc: Record<string, any>, user: any) => {
                acc[user.id] = {
                    id: user.id,
                    userName: user.userName,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    media: user.media || {},
                };
                return acc;
            }, {}),
            // Scrolling back has more; a poll never does — the client polls again.
            hasMore: after ? false : hasMore,
            canPost: access.canPost,
            isMuted: !!access.member?.shouldMuteNotifs,
            lastReadAt: access.member?.chatLastReadAt || null,
            reactionOptions: PACT_CHAT_REACTIONS,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACT_CHAT_ROUTES:ERROR' });
    }
};

/**
 * Queues one chat push per other active, unmuted member who has not blocked the sender. Never
 * throws: the message is already saved, and a notification failure must not fail the send.
 */
export const enqueuePactMessagePushes = async ({
    pact, message, senderUserId, locale, whiteLabelOrigin,
}: {
    pact: any; message: IPactMessageRow; senderUserId: string; locale: string; whiteLabelOrigin?: string;
}): Promise<{ queued: number; failed: number }> => {
    try {
        const members = await Store.pactMembers.getByPactId(pact.id);
        const candidates = members.filter((member: any) => member.userId !== senderUserId
            && member.status === 'active'
            && !member.shouldMuteNotifs);
        if (!candidates.length) {
            return { queued: 0, failed: 0 };
        }

        const recipientRows = await Store.users.findUsers({ ids: candidates.map((m: any) => m.userId) }, ['id', 'blockedUsers']);
        const blockersOfSender = new Set(recipientRows
            .filter((row: any) => Array.isArray(row.blockedUsers) && row.blockedUsers.includes(senderUserId))
            .map((row: any) => row.id));
        const recipients = candidates.filter((member: any) => !blockersOfSender.has(member.userId));

        const [senderName, habitName] = await Promise.all([
            resolveUserDisplayName(senderUserId),
            pact.habitGoalId ? resolveHabitDisplayName(pact.habitGoalId) : Promise.resolve(''),
        ]);
        const scheduledFor = new Date(new Date(message.createdAt).getTime() + PACT_MESSAGE_PUSH_DELAY_MS);

        const outcomes = await Promise.all(recipients.map((member: any) => enqueueNotification({
            // Hard-pinned: pact chat exists only in the HABITS app, and a lost header must never
            // address the push to the recipient's Therr install.
            brandVariation: BrandVariations.HABITS,
            toUserId: member.userId,
            type: PushNotifications.Types.pactMessage,
            dedupeKey: buildPactMessageDedupeKey(pact.id, message.createdAt, member.chatLastReadAt),
            scheduledFor,
            payload: {
                locale,
                whiteLabelOrigin,
                fromUserId: senderUserId,
                fromUserName: senderName,
                habitName,
                pactId: pact.id,
                messagePreview: buildMessagePreview(message.text),
                // The freshness gate compares this with the recipient's read watermark.
                messageCreatedAt: toIso(message.createdAt),
            },
        })));

        return {
            queued: outcomes.filter((outcome) => outcome === 'queued').length,
            failed: outcomes.filter((outcome) => outcome === 'failed').length,
        };
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Pact chat: failed to queue message pushes'],
            traceArgs: {
                'error.message': err?.message,
                'pact.id': pact?.id,
                source: 'users-service',
            },
        });
        return { queued: 0, failed: 1 };
    }
};

// CREATE
const createPactMessage: RequestHandler = async (req: any, res: any) => {
    const {
        locale, userId, whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const { pactId } = req.params;
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const clientMessageId = typeof req.body?.clientMessageId === 'string' ? req.body.clientMessageId : undefined;

    if (!text || text.length > MAX_MESSAGE_LENGTH) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pactChat.invalidText', { max: MAX_MESSAGE_LENGTH }),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }
    if (clientMessageId !== undefined && !UUID_PATTERN.test(clientMessageId)) {
        return handleHttpError({
            res, message: translate(locale, 'errorMessages.pactChat.invalidClientMessageId'), statusCode: 400, errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    try {
        const access = await loadAccess(req, res, pactId, true);
        if (!access) return undefined;

        const { message, isNew } = await Store.pactChat.createMessage({
            pactId, userId, text, clientMessageId,
        });

        if (isNew) {
            // The sender has read their own message; without this it would count against them
            // the moment they wrote anything after their last read.
            await Store.pactChat.markRead(pactId, userId, new Date(message.createdAt)).catch(() => 0);
            await enqueuePactMessagePushes({
                pact: access.pact, message, senderUserId: userId, locale, whiteLabelOrigin,
            });
        }

        return res.status(isNew ? 201 : 200).send({ item: messageToItem(message) });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACT_CHAT_ROUTES:ERROR' });
    }
};

// UPDATE
const markPactChatRead: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { pactId } = req.params;

    try {
        const access = await loadAccess(req, res, pactId);
        if (!access) return undefined;

        await Store.pactChat.markRead(pactId, userId);
        return res.status(200).send({ pactId, unreadMessageCount: 0 });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACT_CHAT_ROUTES:ERROR' });
    }
};

/**
 * Is `targetId` an item of this pact's thread? A message must be one of the thread's messages,
 * and a check-in one of its completed check-ins — so no one can react on, or learn the existence
 * of, an item from a pact they are not in.
 */
const isTargetInThread = async (targetKind: PactChatTargetKind, targetId: string, threadPactIds: string[]): Promise<boolean> => {
    if (targetKind === 'message') {
        const message = await Store.pactChat.getMessageById(targetId);
        return !!message && threadPactIds.includes(message.pactId);
    }
    const checkin = await Store.habitCheckins.getById(targetId);
    return !!checkin && checkin.status === 'completed' && threadPactIds.includes(checkin.pactId);
};

const setPactChatReaction: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { pactId } = req.params;
    const { targetId, targetKind } = req.body || {};
    const emoji = req.body?.emoji ?? null;

    if (!['message', 'checkin'].includes(targetKind) || !UUID_PATTERN.test(String(targetId || ''))
        || (emoji !== null && !PACT_CHAT_REACTIONS.includes(emoji))) {
        return handleHttpError({
            res, message: translate(locale, 'errorMessages.pactChat.invalidReaction'), statusCode: 400, errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    try {
        const access = await loadAccess(req, res, pactId, true);
        if (!access) return undefined;

        const threadPactIds = await Store.pactChat.getThreadPactIds(pactId);
        if (!(await isTargetInThread(targetKind, targetId, threadPactIds))) {
            return handleHttpError({
                res, message: translate(locale, 'errorMessages.pactChat.itemNotFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        if (emoji === null) {
            await Store.pactChat.clearReaction(targetId, userId);
        } else {
            await Store.pactChat.setReaction({
                pactId, userId, targetKind, targetId, emoji,
            });
        }

        const reactions = await Store.pactChat.getReactions([targetId]);
        return res.status(200).send({
            targetId,
            reactions: reactions.map((reaction) => ({ userId: reaction.userId, emoji: reaction.emoji })),
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACT_CHAT_ROUTES:ERROR' });
    }
};

const reportPactMessage: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { pactId, messageId } = req.params;

    if (!UUID_PATTERN.test(String(messageId || ''))) {
        return handleHttpError({
            res, message: translate(locale, 'errorMessages.pactChat.itemNotFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    try {
        const access = await loadAccess(req, res, pactId);
        if (!access) return undefined;

        const [message, threadPactIds] = await Promise.all([
            Store.pactChat.getMessageById(messageId),
            Store.pactChat.getThreadPactIds(pactId),
        ]);
        if (!message || !threadPactIds.includes(message.pactId)) {
            return handleHttpError({
                res, message: translate(locale, 'errorMessages.pactChat.itemNotFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
            });
        }
        if (message.userId === userId) {
            return handleHttpError({
                res, message: translate(locale, 'errorMessages.pactChat.cannotReportOwn'), statusCode: 400, errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        await Store.pactChat.reportMessage(messageId, userId);

        // The same column the existing "report user" path writes (handlers/users.ts reportUser),
        // so a chat report lands where moderation already looks.
        const [author] = await Store.users.findUser({ id: message.userId }, ['id', 'wasReportedBy']);
        if (author) {
            const reportedBy = Array.isArray(author.wasReportedBy) ? author.wasReportedBy : [];
            if (!reportedBy.includes(userId)) {
                await Store.users.updateUser({ wasReportedBy: [...reportedBy, userId] }, { id: message.userId });
            }
        }

        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Pact chat: message reported'],
            traceArgs: {
                'pact.id': pactId,
                'pactMessage.id': messageId,
                'user.id': userId,
                source: 'users-service',
            },
        });

        return res.status(200).send({ messageId, isReported: true });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACT_CHAT_ROUTES:ERROR' });
    }
};

/**
 * Mutes the whole pact for the caller. `shouldMuteNotifs` already silences partner check-in
 * celebrations (`selectPactPartnerIds({ onlyCelebrating })`), so one switch covers the pact.
 */
const setPactChatMute: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { pactId } = req.params;
    const { isMuted } = req.body || {};

    if (typeof isMuted !== 'boolean') {
        return handleHttpError({
            res, message: translate(locale, 'errorMessages.pactChat.invalidMute'), statusCode: 400, errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    try {
        const access = await loadAccess(req, res, pactId);
        if (!access) return undefined;
        if (!access.member) {
            // A legacy pact with no member rows has nowhere to store the preference.
            return handleHttpError({
                res, message: translate(locale, 'errorMessages.pacts.notParticipant'), statusCode: 403, errorCode: ErrorCodes.NOT_PERMITTED,
            });
        }

        await Store.pactMembers.updateByPactAndUser(pactId, userId, { shouldMuteNotifs: isMuted });
        return res.status(200).send({ pactId, isMuted });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACT_CHAT_ROUTES:ERROR' });
    }
};

/**
 * Adds `unreadMessageCount` to each pact for the viewer. Fails safe: it rides the pact list and
 * detail responses, and must never fail them — including in the window between this build rolling
 * out and its migration running (`_bin/cicd/run-migrations.sh` runs after the rollout), when the
 * chat tables do not exist yet.
 */
export const attachUnreadMessageCounts = async <T extends { id: string }>(pacts: T[], userId: string): Promise<T[]> => {
    if (!pacts.length || !userId) {
        return pacts;
    }
    try {
        const blockedUserIds = await getBlockedUserIds(userId);
        const counts = await Store.pactChat.countUnreadByPact(pacts.map((pact) => pact.id), userId, blockedUserIds);
        return pacts.map((pact) => ({ ...pact, unreadMessageCount: counts[pact.id] || 0 }));
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Pact chat: unread counts unavailable; returning pacts without them'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': userId,
                source: 'users-service',
            },
        });
        return pacts;
    }
};

export {
    getPactChat,
    createPactMessage,
    markPactChatRead,
    setPactChatReaction,
    reportPactMessage,
    setPactChatMute,
};
