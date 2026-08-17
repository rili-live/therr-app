import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';

/**
 * Has this user completed the invite-a-friend onboarding?
 *
 * The answer is "has a pact they created ever had a partner invited to it" —
 * not "does an active pact exist". The distinction is the whole point of the
 * feature:
 *
 *   - Gating on an *active* pact makes the user's progress depend on someone
 *     else's action. A friend who installs the app a week later, or never,
 *     leaves the inviter parked on the onboarding overlay with nothing they can
 *     do about it. That is a dead end, and it is the retention hole solo habits
 *     exist to close.
 *   - Gating on an *invite sent* keeps the requirement intact. The user still
 *     has to pick a habit, pick a person and send the invitation before the app
 *     will let them track anything alone, which is the behaviour the mandatory
 *     social onboarding was there to produce.
 *
 * Declined and abandoned pacts still count. The user did the thing that was
 * asked of them; whether the friend said yes is not a test they can pass on
 * their own, and re-locking someone after a decline would punish them for it.
 *
 * Fails CLOSED on error, unlike the habit cap. Wrongly allowing solo habits
 * would let a user skip the onboarding that the growth loop depends on and
 * cannot be undone once they have habits; wrongly denying is a retryable error
 * on a screen the user is already on.
 */
export const hasSentPactInvite = async (userId: string): Promise<boolean> => {
    try {
        return await Store.pactMembers.countInvitedByCreator(userId).then((count) => count > 0);
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
        return false;
    }
};

export default { hasSentPactInvite };
