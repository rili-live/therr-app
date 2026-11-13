/**
 * What happens the first time a pact is opened to join requests — at creation with `isOpen`, or
 * later with the open toggle (handlers/pactJoinRequests.ts → setPactOpen).
 *
 *   1. The creator earns `LeaderboardXpValues.openPactOpened`.
 *   2. People who may want to join are told it exists: they actively track the same habit, are in
 *      no pact on it, have not muted habit reminders, and have the Habits app to receive a push
 *      (see PactsStore.getInterestedUsersForOpenPact).
 *
 * Both are once per pact, ever, behind the `firstOpenedAt` claim — a creator toggling their pact
 * closed and open again earns and announces nothing the second time.
 *
 * Bounded so it stays a supplement rather than a broadcast:
 *   - at most OPEN_PACT_ANNOUNCEMENT_MAX_RECIPIENTS recipients per pact;
 *   - at most one announcement per recipient per UTC day, across every pact (the dedupe key);
 *   - queued, so the per-user daily cap and send spacing apply;
 *   - a recipient in quiet hours is scheduled for their morning instead of woken.
 *
 * Never throws: it runs after the response-worthy work is done and must not fail a request.
 */

import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { isTestAccount } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import enqueueNotification, { EnqueueOutcome } from '../../utilities/enqueueNotification';
import { LeaderboardXpValues } from '../../utilities/leaderboardHelpers';
import { isInQuietHoursAt, resolveReminderSchedule } from '../../utilities/localReminderSchedule';
import {
    getHabitMatchKey,
    isPactJoinable,
    MAX_OPEN_PACT_MEMBERS,
    OPEN_PACT_ANNOUNCEMENT_CANDIDATE_POOL,
    OPEN_PACT_ANNOUNCEMENT_MAX_RECIPIENTS,
    openPactAnnouncementDedupeKey,
} from '../../utilities/openPacts';
import { awardLeaderboardPoints } from './leaderboards';

/**
 * Kill switch for the push only — the creator's XP is not a send and is not gated by it. Defaults
 * **on**: volume is bounded per pact and per recipient. A flag so it can be stopped without a deploy.
 */
export const areOpenPactAnnouncementsEnabled = (): boolean => process.env.HABIT_OPEN_PACT_ANNOUNCEMENTS_ENABLED !== 'false';

export interface IOpenPactAnnouncementResult {
    /** False when the pact was already announced, or is not joinable. Nothing else happened. */
    claimed: boolean;
    candidates: number;
    queued: number;
    duplicates: number;
    failed: number;
}

const EMPTY_RESULT: IOpenPactAnnouncementResult = {
    claimed: false,
    candidates: 0,
    queued: 0,
    duplicates: 0,
    failed: 0,
};

export const announceOpenedPact = async (
    headers: Record<string, any>,
    pact: { id: string; creatorUserId: string; habitGoalId: string; isOpen?: boolean | null; status?: string; endDate?: Date | string | null },
    now: Date = new Date(),
): Promise<IOpenPactAnnouncementResult> => {
    const result: IOpenPactAnnouncementResult = { ...EMPTY_RESULT };

    try {
        // Not joinable, or no seat left (a group pact whose invitees fill it): nobody could join it.
        if (!isPactJoinable(pact, now) || await Store.pacts.countSeats(pact.id) >= MAX_OPEN_PACT_MEMBERS) {
            return result;
        }

        result.claimed = await Store.pacts.claimFirstOpen(pact.id);
        if (!result.claimed) {
            return result;
        }

        // To the creator: the caller of both entry points, and the only one who can open a pact.
        awardLeaderboardPoints(
            { ...headers, 'x-userid': pact.creatorUserId } as any,
            LeaderboardXpValues.openPactOpened,
            `open-pact-opened:${pact.id}`,
        );

        if (!areOpenPactAnnouncementsEnabled()) {
            return result;
        }

        const habitGoal = await Store.habitGoals.getById(pact.habitGoalId);
        if (!habitGoal) {
            return result;
        }

        const prospects = await Store.pacts.getInterestedUsersForOpenPact(
            pact.id,
            getHabitMatchKey(habitGoal),
            isTestAccount(headers),
            OPEN_PACT_ANNOUNCEMENT_CANDIDATE_POOL,
        );
        result.candidates = prospects.length;
        if (!prospects.length) {
            return result;
        }

        // Pinned, not read from the request: pacts exist only in Friends with Habits, and this brand
        // selects which app's device token the push goes to.
        const brandVariation = BrandVariations.HABITS;
        const tokens = await Store.userDeviceTokens.getTokensForUsers(brandVariation, prospects.map((p) => p.userId));
        const reachable = new Set((tokens || []).map((row: any) => row.userId));
        const recipients = prospects
            .filter((prospect) => reachable.has(prospect.userId))
            .slice(0, OPEN_PACT_ANNOUNCEMENT_MAX_RECIPIENTS);

        const dedupeKey = openPactAnnouncementDedupeKey(now);
        const outcomes: EnqueueOutcome[] = await Promise.all(recipients.map((recipient) => enqueueNotification({
            brandVariation,
            toUserId: recipient.userId,
            type: PushNotifications.Types.openPactAvailable,
            dedupeKey,
            payload: {
                locale: recipient.settingsLocale || 'en-us',
                pactId: pact.id,
                habitGoalId: pact.habitGoalId,
                habitName: habitGoal.name || '',
            },
            // Now, unless that is the middle of their night — then their morning slot.
            scheduledFor: isInQuietHoursAt(recipient, now)
                ? resolveReminderSchedule(recipient, now, { jitterSeed: recipient.userId }).morningAt
                : undefined,
        })));

        outcomes.forEach((outcome) => {
            if (outcome === 'queued') result.queued += 1;
            else if (outcome === 'duplicate') result.duplicates += 1;
            else result.failed += 1;
        });

        logSpan({
            level: result.failed ? 'warn' : 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Open pact announced'],
            traceArgs: {
                'pact.id': pact.id,
                'openPactAnnouncement.candidates': result.candidates,
                'openPactAnnouncement.queued': result.queued,
                'openPactAnnouncement.duplicates': result.duplicates,
                'openPactAnnouncement.failed': result.failed,
            },
        });
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to announce an opened pact'],
            traceArgs: { 'error.message': err?.message, 'pact.id': pact.id },
        });
    }

    return result;
};
