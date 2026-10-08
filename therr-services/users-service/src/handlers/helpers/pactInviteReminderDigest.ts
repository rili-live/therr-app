/**
 * The pact invite reminder: one pass inside the daily habits digest.
 *
 * An invitee who already uses Habits is told about a pact exactly once — the `pactInvitation`
 * push sent when they are invited (`dispatchPactInvitation` routes everyone else to an email or
 * SMS claim link instead). Nothing followed it. In production on 2026-10-08, 27 of the 28
 * invitees on unanswered pacts were already Habits users, and the in-app invitation was read 16%
 * of the time; meanwhile 20 of the 21 users whose pact *was* accepted had checked in. A friend
 * waiting on you is the strongest pull this app has, and it was being spent once.
 *
 * So this re-sends that same push — Accept/View actions and all — once per invite, a day after
 * it went unanswered. It deliberately reuses `pactInvitation` rather than adding a type: the copy
 * ("{userName} invited you to do {habitName} together") is still exactly true, and every place a
 * push type must be registered (see /push-notification-guard) already knows this one.
 *
 * Bounded:
 *   - only invites INVITE_REMINDER_MIN_AGE_DAYS..MAX_AGE_DAYS old;
 *   - once per invite ever (the dateless `pactInviteReminderDedupeKey`), at most one per invitee
 *     per run;
 *   - only invitees with a device on this brand who have not turned invite pushes off;
 *   - re-checked at send time (`checkinNudgeFreshness`), so an invite accepted between queueing and
 *     the user's morning sends nothing.
 *
 * Invitees who are *not* on Habits yet hold a claim link, and reminding them is a different
 * problem — the seat-expiry sequence in #3011.
 */

import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { resolveReminderSchedule } from '../../utilities/localReminderSchedule';
import { createNameResolvers } from '../../utilities/notificationNames';
import { QueueRecapFn } from './weeklyRecapDigest';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Long enough that the original push has had its chance; an accepted invite is accepted in minutes. */
export const INVITE_REMINDER_MIN_AGE_DAYS = 1;

/**
 * The claim link an off-brand invitee gets expires after 14 days (`dispatchPactInvitation`), so
 * this gives an on-brand invite the same lifetime. It also keeps the dateless dedupe key safe:
 * a sent row is purged from the queue after 30 days, by which time its invite is far outside
 * this window and can never be selected again.
 */
export const INVITE_REMINDER_MAX_AGE_DAYS = 14;

/** Upper bound per run. Reported via `invitesCapped` rather than silently truncated. */
export const INVITE_REMINDER_MAX_INVITES = 500;

/**
 * Once per invite, ever — so no date. That makes a dropped row permanent, which is why
 * `pact-invitation` is in the queue worker's UNCAPPABLE_TYPES.
 */
export const pactInviteReminderDedupeKey = (pactMemberId: string) => `pact-invite-reminder:${pactMemberId}`;

/**
 * Kill switch. Defaults **on**: the volume is bounded at one push per unanswered invite. It stays a
 * flag because it is still a send, and this is the lever that stops it without a deploy.
 */
export const arePactInviteRemindersEnabled = (): boolean => process.env.HABIT_PACT_INVITE_REMINDERS_ENABLED !== 'false';

export interface IPactInviteReminderCounters {
    /** Unanswered invites in the window whose invitee uses this brand. */
    invitesEvaluated: number;
    remindersQueued: number;
    /** Already queued by an earlier run. Every run after the first lands here. */
    remindersDeduped: number;
    /** The invitee has no device token on this brand, or has muted habit reminders. */
    remindersNoChannel: number;
    /** A second invite for an invitee already reminded this run; left for a later run. */
    remindersDeferredSameUser: number;
    reminderErrors: number;
    invitesCapped: boolean;
}

export const EMPTY_PACT_INVITE_REMINDER_COUNTERS: IPactInviteReminderCounters = {
    invitesEvaluated: 0,
    remindersQueued: 0,
    remindersDeduped: 0,
    remindersNoChannel: 0,
    remindersDeferredSameUser: 0,
    reminderErrors: 0,
    invitesCapped: false,
};

export const runPactInviteReminderPass = async (
    queuePush: QueueRecapFn,
    brandVariation: BrandVariations,
    now: Date = new Date(),
): Promise<IPactInviteReminderCounters> => {
    const counters: IPactInviteReminderCounters = { ...EMPTY_PACT_INVITE_REMINDER_COUNTERS };

    if (!arePactInviteRemindersEnabled()) {
        return counters;
    }

    const invites = await Store.pactMembers.getUnansweredInvitesForReminder(
        brandVariation,
        new Date(now.getTime() - INVITE_REMINDER_MIN_AGE_DAYS * MS_PER_DAY),
        new Date(now.getTime() - INVITE_REMINDER_MAX_AGE_DAYS * MS_PER_DAY),
        INVITE_REMINDER_MAX_INVITES,
    );
    counters.invitesEvaluated = invites.length;
    counters.invitesCapped = invites.length >= INVITE_REMINDER_MAX_INVITES;
    if (!invites.length) {
        return counters;
    }

    // One reminder per invitee per run: rows are oldest first, so their oldest invite goes now and
    // any other waits for a later run (each is still reminded about at most once).
    const seenInvitees = new Set<string>();
    const firstPerInvitee = invites.filter((invite) => {
        if (seenInvitees.has(invite.inviteeUserId)) {
            counters.remindersDeferredSameUser += 1;
            return false;
        }
        seenInvitees.add(invite.inviteeUserId);
        return true;
    });

    const inviteeIds = firstPerInvitee.map((invite) => invite.inviteeUserId);
    const [preferencesByUserId, deviceTokens] = await Promise.all([
        Store.users.getHabitReminderPreferences(inviteeIds),
        Store.userDeviceTokens.getTokensForUsers(brandVariation, inviteeIds),
    ]);
    const inviteesWithDevice = new Set((deviceTokens || []).map((row: any) => row.userId));
    // The same naming rule as every other habits push, and memoized: one creator often invites several people.
    const names = createNameResolvers();

    // Sequential: one enqueue per invite and a small population. Keeps the log order deterministic.
    // eslint-disable-next-line no-restricted-syntax
    for (const invite of firstPerInvitee) {
        try {
            const preferences = preferencesByUserId[invite.inviteeUserId] || {};
            if (!inviteesWithDevice.has(invite.inviteeUserId) || preferences.settingsPushHabitReminders === false) {
                counters.remindersNoChannel += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            const schedule = resolveReminderSchedule(preferences, now, { jitterSeed: invite.inviteeUserId });
            // eslint-disable-next-line no-await-in-loop
            const inviterName = await names.getUserDisplayName(invite.creatorUserId);
            // eslint-disable-next-line no-await-in-loop
            const outcome = await queuePush(
                invite.inviteeUserId,
                PushNotifications.Types.pactInvitation,
                pactInviteReminderDedupeKey(invite.pactMemberId),
                {
                    // `fromUser` and `fromUserId` are what the worker turns into the push's
                    // "{userName}" and its x-userid; `pactId` is what the Accept action accepts.
                    // `pactMemberId` is for the send-time check that the invite is still open.
                    fromUser: { id: invite.creatorUserId, userName: inviterName },
                    fromUserId: invite.creatorUserId,
                    pactId: invite.pactId,
                    pactMemberId: invite.pactMemberId,
                    habitName: invite.habitGoalName || '',
                },
                schedule.morningAt,
            );
            if (outcome === 'queued') {
                counters.remindersQueued += 1;
            } else if (outcome === 'duplicate') {
                counters.remindersDeduped += 1;
            } else {
                counters.reminderErrors += 1;
            }
        } catch (err: any) {
            counters.reminderErrors += 1;
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Habits digest: pact invite reminder failed'],
                traceArgs: {
                    'pactMember.id': invite.pactMemberId,
                    'user.id': invite.inviteeUserId,
                },
            });
        }
    }

    return counters;
};
