import { IPact, IPactMember } from 'therr-react/types';

/**
 * Member statuses that mean the viewer was in this pact and no longer is. Such a viewer can still
 * open the pact (their member row keeps it in their history, and an old notification still points
 * at it), but nothing on the screen is theirs to act on any more.
 *
 * The common way in is an open-pact handoff: when a creator goes quiet while someone waits to join,
 * the daily digest gives the pact a new host and marks the creator `left`
 * (users-service handlers/helpers/openPactHandoff.ts). Without this state they would land on their
 * old pact from a "someone asked to join" notification and find no way to answer it, and no word
 * of why.
 */
const FORMER_MEMBER_STATUSES = ['left', 'removed'];

export interface IFormerMemberState {
    /** Who runs the pact now. Absent when the members list does not include them. */
    hostMember?: IPactMember;
    /**
     * Whether to offer "Ask to join again": only to someone who left (not someone removed), and
     * only while the pact is open and can still take members — mirroring users-service
     * `isPactJoinable`, which refuses the request otherwise.
     */
    canAskToRejoin: boolean;
}

export const getFormerMemberState = (
    pact?: IPact | null,
    currentUserId?: string,
    now: number = Date.now(),
): IFormerMemberState | null => {
    if (!pact || !currentUserId || pact.creatorUserId === currentUserId) {
        return null;
    }
    const member = pact.members?.find((m) => m.userId === currentUserId);
    if (!member || !FORMER_MEMBER_STATUSES.includes(member.status)) {
        return null;
    }

    const isRunning = (pact.status === 'pending' || pact.status === 'active')
        && (!pact.endDate || new Date(pact.endDate).getTime() > now);

    return {
        hostMember: pact.members?.find((m) => m.userId === pact.creatorUserId),
        canAskToRejoin: member.status === 'left' && pact.isOpen === true && isRunning,
    };
};

export default getFormerMemberState;
