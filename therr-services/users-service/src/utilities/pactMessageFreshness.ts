import { PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { INotificationQueueRow } from '../store/NotificationQueueStore';

/**
 * Send-time gate for pact chat pushes (handlers/pactChat.ts `enqueuePactMessagePushes`).
 *
 * A chat push is queued ~90s out so that a partner already in the thread reads the message
 * first. Its payload carries `messageCreatedAt`; the push is skipped when the recipient's read
 * watermark (`pact_members.chatLastReadAt`) has passed it, when they have since muted the pact,
 * or when they are no longer an active member. Fails open like the other gates in
 * checkinNudgeFreshness.ts: an extra push is visible and recoverable, silence is neither.
 */

export const PACT_MESSAGE_TYPES: Set<string> = new Set([
    String(PushNotifications.Types.pactMessage),
]);

export interface IPactMessageFreshness {
    shouldSend: boolean;
    reason?: string;
}

const SEND: IPactMessageFreshness = { shouldSend: true };

/** Pure decision, separated from the read so the rule can be pinned without a database. */
export const decidePactMessageFreshness = (
    member: { status?: string; shouldMuteNotifs?: boolean; chatLastReadAt?: Date | string | null } | undefined,
    messageCreatedAt: string,
): IPactMessageFreshness => {
    if (!member || member.status !== 'active') {
        return { shouldSend: false, reason: 'no-longer-a-member' };
    }
    if (member.shouldMuteNotifs) {
        return { shouldSend: false, reason: 'pact-muted' };
    }
    const messageAt = new Date(messageCreatedAt).getTime();
    const readAt = member.chatLastReadAt ? new Date(member.chatLastReadAt).getTime() : NaN;
    if (Number.isFinite(messageAt) && Number.isFinite(readAt) && readAt >= messageAt) {
        return { shouldSend: false, reason: 'already-read' };
    }
    return SEND;
};

const evaluatePactMessageFreshness = async (row: INotificationQueueRow): Promise<IPactMessageFreshness> => {
    const pactId = row.payload?.pactId;
    const messageCreatedAt = row.payload?.messageCreatedAt;
    if (typeof pactId !== 'string' || !pactId || typeof messageCreatedAt !== 'string') {
        return SEND;
    }

    try {
        const member = await Store.pactMembers.getByPactAndUser(pactId, row.userId);
        return decidePactMessageFreshness(member, messageCreatedAt);
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Notification queue: pact message freshness read failed; sending anyway'],
            traceArgs: {
                'error.message': err?.message,
                'notificationQueue.id': row.id,
                'notificationQueue.type': row.type,
                'user.id': row.userId,
                source: 'users-service',
            },
        });
        return SEND;
    }
};

export default evaluatePactMessageFreshness;
