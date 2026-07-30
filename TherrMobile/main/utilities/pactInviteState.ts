import { IPact } from 'therr-react/types';

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

export default isPactInviteAwaitingResponse;

export {
    isPactInviteAwaitingResponse,
};
