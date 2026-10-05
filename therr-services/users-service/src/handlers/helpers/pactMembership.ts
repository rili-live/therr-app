import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { ensureCompletedUserConnection } from './inviteAcceptance';

/**
 * Everything that has to be true once `userId` becomes an active member of `pact` — whichever way
 * they got there. Shared by accepting an invite (handlers/pacts.ts § acceptPact) and by the creator
 * approving a join request on an open pact (handlers/pactJoinRequests.ts), so the two paths cannot
 * drift on what "joined" means. The member row must already exist; this activates it.
 *
 * The first joiner activates a pending pact, and with it the creator: their member row, streak and
 * tracking row. Later joiners only touch their own.
 *
 * Returns the pact as it stands afterwards.
 */
export const activatePactMembership = async (pact: any, userId: string) => {
    const isFirstJoin = pact.status === 'pending';
    const updatedPact = isFirstJoin ? await Store.pacts.activate(pact.id) : pact;

    // activate() is an idempotent UPDATE, so calling it on an already-active member is safe.
    const memberActivations: Promise<any>[] = [Store.pactMembers.activate(pact.id, userId)];
    if (isFirstJoin) {
        memberActivations.push(Store.pactMembers.activate(pact.id, pact.creatorUserId));
    }
    await Promise.all(memberActivations);

    // Streaks: always for the joiner; for the creator only when the pact goes pending → active.
    // getOrCreate makes this idempotent.
    const streakPromises: Promise<any>[] = [
        Store.streaks.getOrCreate(userId, pact.habitGoalId, pact.id),
    ];
    if (isFirstJoin) {
        streakPromises.push(Store.streaks.getOrCreate(pact.creatorUserId, pact.habitGoalId, pact.id));
    }
    await Promise.all(streakPromises);

    // Tracking rows, mirroring the streak logic above: always for the joiner, and for the creator
    // only on first join.
    //
    // Both go through getOrCreate *and* reviveArchivedByHabit. getOrCreate deliberately will not
    // resurrect an archived row (a stray check-in must not un-archive a habit and put the user back
    // over the cap), but someone joining is precisely the event that should:
    //   - the creator may have archived this habit to stop the reminders while nobody had joined —
    //     "revive only if somebody joins after the fact" is exactly this path;
    //   - the joiner may have archived the same goal in a past life, and they just passed the
    //     capacity check for the slot.
    // reviveArchivedByHabit is a no-op when the row is already active, so every join after the
    // first costs one guarded UPDATE and nothing else.
    const ensureActiveTracking = async (trackingUserId: string) => {
        await Store.userHabits.getOrCreate(trackingUserId, pact.habitGoalId);
        await Store.userHabits.reviveArchivedByHabit(trackingUserId, pact.habitGoalId);
    };
    const trackingPromises: Promise<any>[] = [ensureActiveTracking(userId)];
    if (isFirstJoin) {
        trackingPromises.push(ensureActiveTracking(pact.creatorUserId));
    }
    await Promise.all(trackingPromises);

    // Accountability partners are connections by definition — guarantee the userConnection exists
    // so each partner appears in the other's connections list (invited-user-is-connected-to-inviter
    // contract). Fire-and-forget: a connection failure must not block joining.
    ensureCompletedUserConnection(pact.creatorUserId, userId).catch((err) => {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to ensure connection between pact partners on join'],
            traceArgs: { 'error.message': err?.message, pactId: pact.id },
        });
    });

    return updatedPact;
};

export default activatePactMembership;
