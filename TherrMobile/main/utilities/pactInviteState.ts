import { IPact, IPactMember } from 'therr-react/types';

// How long an invite may sit unanswered after a nudge before the sender is
// offered a way out (invite someone else). Independent of the server-side
// nudge cooldown, which is 7 days — see users-service `handlers/pacts.ts`.
const NUDGE_RECOVERY_AFTER_MS = 24 * 60 * 60 * 1000;

export interface ISentInviteState {
    partnerMember?: IPactMember;
    invitedAt: Date;
    nudgedAt: Date | null;
    /** No nudge sent yet, so offer one. */
    canNudge: boolean;
    /** A nudge was sent recently — acknowledge it instead of repeating it. */
    nudgeSentRecently: boolean;
    /** Nudged and still no answer: offer to invite someone else. */
    showRecoveryPath: boolean;
}

/**
 * Whether this user still has an outstanding invite on the given pact — i.e.
 * whether Accept/Decline should be offered.
 *
 * Mirrors the accept/decline authorization in the users-service
 * (`src/handlers/pacts.ts`): 1:1 invites are identified by
 * `pacts.partnerUserId` on a pact that is itself still `pending`, while group
 * invites leave that column null and track membership in `pact_members`. A
 * member row with `role=partner` and `status=pending` is therefore an open
 * invite even once the pact has been activated by another invitee accepting
 * first — the client must not gate on `pact.status === 'pending'` alone.
 */
const isPactInviteAwaitingResponse = (pact?: IPact, currentUserId?: string): boolean => {
    if (!pact || !currentUserId) {
        return false;
    }

    const member = pact.members?.find((m) => m.userId === currentUserId);
    const hasPendingMemberInvite = member?.role === 'partner' && member?.status === 'pending';

    return hasPendingMemberInvite
        || (pact.partnerUserId === currentUserId && pact.status === 'pending');
};

/**
 * Derives what the sender should see for an invite they sent: nudge, an
 * acknowledgement of the nudge they already sent, or — once a nudge has gone
 * unanswered for a day — a way to invite someone else instead.
 */
const getSentInviteState = (
    pact: IPact,
    currentUserId?: string,
    now: number = Date.now(),
): ISentInviteState => {
    const partnerMember = pact.members?.find((m) => m.role === 'partner')
        || pact.members?.find((m) => m.userId !== currentUserId);
    const invitedAt = partnerMember?.invitedAt
        ? new Date(partnerMember.invitedAt)
        : new Date(pact.createdAt);
    const nudgedAt = partnerMember?.nudgedAt ? new Date(partnerMember.nudgedAt) : null;
    const nudgeAge = nudgedAt ? now - nudgedAt.getTime() : null;

    return {
        partnerMember,
        invitedAt,
        nudgedAt,
        canNudge: !nudgedAt,
        nudgeSentRecently: nudgeAge !== null && nudgeAge < NUDGE_RECOVERY_AFTER_MS,
        showRecoveryPath: nudgeAge !== null && nudgeAge >= NUDGE_RECOVERY_AFTER_MS,
    };
};

export default isPactInviteAwaitingResponse;

export {
    isPactInviteAwaitingResponse,
    getSentInviteState,
    NUDGE_RECOVERY_AFTER_MS,
};
