import { HABITS_SOLO_UNLOCK_INVITE_COUNT } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';

export interface ISoloInviteProgress {
    /** Distinct people this user has invited to a pact they created. */
    invitedCount: number;
    /** How many are needed to unlock solo habits. */
    requiredCount: number;
    canCreateSolo: boolean;
}

/**
 * Progress toward unlocking personal ("solo") habits.
 *
 * Friends with Habits requires you to bring people with you before you can
 * track anything alone; that mandatory invite is the growth loop. This returns
 * the whole picture rather than a boolean because the requirement only works as
 * a growth lever if the user can *see* it coming — a bare "no" reads as a wall,
 * while "2 of 3 friends invited" reads as something to finish. Callers need the
 * numbers on both the allow and the deny path, so both carry them.
 *
 * WHAT COUNTS
 *
 * Invites *sent*, to distinct people, in any state. Two deliberate choices:
 *
 *   - Sent, not accepted. Gating on acceptance measures the friend's action,
 *     not the user's: someone whose friends install the app a week later — or
 *     never — would be parked indefinitely with nothing they could do. Declined
 *     and abandoned pacts still count; the user did what was asked, and
 *     re-locking them for a decline punishes them for someone else's choice.
 *   - Distinct people, not invitations. Otherwise inviting one friend to three
 *     pacts clears a bar meant to put the app in front of three people.
 *
 * Fails CLOSED, unlike the habit cap. Wrongly allowing solo habits skips the
 * onboarding the growth loop depends on and cannot be undone once the user has
 * habits; wrongly denying is a retryable error on a screen they are already on.
 */
export const getSoloInviteProgress = async (userId: string): Promise<ISoloInviteProgress> => {
    const requiredCount = HABITS_SOLO_UNLOCK_INVITE_COUNT;

    try {
        const invitedCount = await Store.pactMembers.countDistinctInvitedByCreator(userId);

        return {
            invitedCount,
            requiredCount,
            canCreateSolo: invitedCount >= requiredCount,
        };
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to evaluate solo habit eligibility; denying'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': userId,
            },
        });

        // Zero rather than the real count: on the deny path the client renders
        // this as progress, and inventing a number we could not read would show
        // the user a bar that jumps backwards on the next successful call.
        return { invitedCount: 0, requiredCount, canCreateSolo: false };
    }
};

export default { getSoloInviteProgress };
