/**
 * The Habits onboarding nurture sequence (#3011): one pass inside the daily habits digest.
 *
 * Every other digest pass reads existing habits or pacts, so an account that signed up and
 * stalled got nothing at all — the users with the most to gain. In production on 2026-10-08, 69%
 * of new Habits accounts had neither a habit nor a pact. This covers them and the invites they
 * leave hanging:
 *
 *   | When              | Who                                   | Channel           | Message           |
 *   |-------------------|---------------------------------------|-------------------|-------------------|
 *   | +24h (to +7d)     | No habit and no pact                  | push, else email  | first-habit nudge |
 *   | +24h (to +7d)     | Inviter of an unanswered invite       | push              | "hasn't joined"   |
 *   | +3d and +10d      | Invitee holding an emailed claim link | email             | seat expiry       |
 *   | +7d               | 3+ check-ins, still no partner        | push              | founder offer     |
 *
 * Each message goes to a user at most once, whichever channel carries it: it is claimed in
 * `habits.onboarding_messages` before it is sent (see migration 20261008000002). Pushes also
 * dedupe through the queue under the same key, which carries no date (CLAUDE.md § Sibling Repos,
 * rule 4). Windows are a range rather than a single day so a skipped digest run delays a message
 * rather than dropping it.
 *
 * Not here, deliberately:
 *   - A welcome email. therr-messaging-automator already sends Habits users its `introHabits`
 *     email on its first daily run after signup; a second one from here would double it.
 *   - An on-app invitee's reminder. That is the pact invite reminder pass (#3062).
 *   - SMS seat reminders. The original SMS was the inviter's own message; an automated follow-up
 *     to someone who never signed up is a different consent question, so phone-only invitees get
 *     nothing extra.
 */

import {
    BrandVariations,
    HABITS_LIFETIME_FOUNDER_LIMIT,
    PushNotifications,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import sendFirstHabitNudgeEmail from '../../api/email/for-social/sendFirstHabitNudgeEmail';
import sendPactSeatReminderEmail from '../../api/email/for-social/sendPactSeatReminderEmail';
import { resolveReminderSchedule } from '../../utilities/localReminderSchedule';
import { createNameResolvers } from '../../utilities/notificationNames';
import { buildPactClaimUrl } from '../../utilities/dispatchPactInvitation';
import translate from '../../utilities/translator';
import { isHabitCapExempt } from './habitCapacity';
import { QueueRecapFn } from './weeklyRecapDigest';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const NO_HABIT_MESSAGE_KEY = 'onboarding:no-habit';
export const FOUNDER_OFFER_MESSAGE_KEY = 'onboarding:founder-offer';
export const INVITER_RESEND_SUFFIX = 'inviter-d1';
export const seatMessageKey = (pactMemberId: string, suffix: string) => `seat:${pactMemberId}:${suffix}`;

/** The two seat-expiry reminders, by invite age. The claim link itself lives 14 days. */
export const SEAT_REMINDERS = [
    { suffix: 'd3', minAgeDays: 3, maxAgeDays: 10 },
    { suffix: 'd10', minAgeDays: 10, maxAgeDays: 14 },
];

export const NUDGE_MIN_AGE_HOURS = 24;
export const NUDGE_MAX_AGE_DAYS = 7;
export const FOUNDER_OFFER_MIN_AGE_DAYS = 7;
export const FOUNDER_OFFER_MIN_CHECKINS = 3;

/** Upper bound per message per run. Reported via `capped` rather than silently truncated. */
export const ONBOARDING_NURTURE_MAX_ROWS = 500;

/**
 * Kill switch. Defaults **on**: every message is once per user (or per invite) ever. It stays a
 * flag because it is still a send, and this is the lever that stops it without a deploy.
 */
export const isOnboardingNurtureEnabled = (): boolean => process.env.HABIT_ONBOARDING_NURTURE_ENABLED !== 'false';

export interface IOnboardingMessageCounters {
    evaluated: number;
    queued: number;
    emailed: number;
    /** Claimed already — by an earlier run, an overlapping one, or a retry. */
    deduped: number;
    /** No channel reached them: no device, no usable email, or the relevant setting off. */
    noChannel: number;
    /** Left for a later run so a user gets one of these per run. */
    deferredSameUser: number;
    errors: number;
    capped: boolean;
}

export interface IOnboardingNurtureCounters {
    noHabitNudge: IOnboardingMessageCounters;
    inviterResend: IOnboardingMessageCounters;
    seatReminders: IOnboardingMessageCounters;
    founderOffer: IOnboardingMessageCounters & { skippedSoldOut: boolean; skippedEntitled: number };
}

const emptyMessageCounters = (): IOnboardingMessageCounters => ({
    evaluated: 0,
    queued: 0,
    emailed: 0,
    deduped: 0,
    noChannel: 0,
    deferredSameUser: 0,
    errors: 0,
    capped: false,
});

export const emptyOnboardingNurtureCounters = (): IOnboardingNurtureCounters => ({
    noHabitNudge: emptyMessageCounters(),
    inviterResend: emptyMessageCounters(),
    seatReminders: emptyMessageCounters(),
    founderOffer: { ...emptyMessageCounters(), skippedSoldOut: false, skippedEntitled: 0 },
});

export interface IOnboardingNurtureContext {
    /** Pinned by the digest. Selects the device token, the email's host context and the claim URL. */
    brandVariation: BrandVariations;
    whiteLabelOrigin: string;
}

const logFailure = (message: string, err: any, traceArgs: Record<string, any>) => logSpan({
    level: 'error',
    messageOrigin: 'API_SERVER',
    messages: [err?.message, `Habits digest: ${message}`],
    traceArgs,
});

/** Which counter an enqueue outcome lands in. `failed` is an error, never a dedupe. */
const outcomeCounter = (outcome: string): 'queued' | 'deduped' | 'errors' => {
    if (outcome === 'queued') {
        return 'queued';
    }
    return outcome === 'duplicate' ? 'deduped' : 'errors';
};

/** Users among `userIds` with a device on the brand, and their habit reminder settings. */
const loadPushReach = async (brandVariation: BrandVariations, userIds: string[]) => {
    if (!userIds.length) {
        return { preferencesByUserId: {} as Record<string, any>, withDevice: new Set<string>() };
    }
    const [preferencesByUserId, deviceTokens] = await Promise.all([
        Store.users.getHabitReminderPreferences(userIds),
        Store.userDeviceTokens.getTokensForUsers(brandVariation, userIds),
    ]);
    return {
        preferencesByUserId: preferencesByUserId as Record<string, any>,
        withDevice: new Set((deviceTokens || []).map((row: any) => row.userId)),
    };
};

const runNoHabitNudge = async (
    queuePush: QueueRecapFn,
    context: IOnboardingNurtureContext,
    now: Date,
): Promise<IOnboardingMessageCounters> => {
    const counters = emptyMessageCounters();
    const candidates = await Store.onboardingMessages.getNoHabitCandidates(
        context.brandVariation,
        NO_HABIT_MESSAGE_KEY,
        new Date(now.getTime() - NUDGE_MIN_AGE_HOURS * MS_PER_HOUR),
        new Date(now.getTime() - NUDGE_MAX_AGE_DAYS * MS_PER_DAY),
        ONBOARDING_NURTURE_MAX_ROWS,
    );
    counters.evaluated = candidates.length;
    counters.capped = candidates.length >= ONBOARDING_NURTURE_MAX_ROWS;

    const { preferencesByUserId, withDevice } = await loadPushReach(context.brandVariation, candidates.map((c) => c.userId));

    // eslint-disable-next-line no-restricted-syntax
    for (const candidate of candidates) {
        try {
            const preferences = preferencesByUserId[candidate.userId] || {};
            const canPush = withDevice.has(candidate.userId) && preferences.settingsPushHabitReminders !== false;
            const canEmail = !!candidate.email && !candidate.isUnclaimed && candidate.settingsEmailReminders !== false;
            if (!canPush && !canEmail) {
                counters.noChannel += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            if (!(await Store.onboardingMessages.claim(candidate.userId, NO_HABIT_MESSAGE_KEY, canPush ? 'push' : 'email'))) {
                counters.deduped += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            if (canPush) {
                const schedule = resolveReminderSchedule(preferences, now, { jitterSeed: candidate.userId });
                // eslint-disable-next-line no-await-in-loop
                const outcome = await queuePush(
                    candidate.userId,
                    PushNotifications.Types.habitsFirstHabitNudge,
                    NO_HABIT_MESSAGE_KEY,
                    {},
                    schedule.morningAt,
                );
                counters[outcomeCounter(outcome)] += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            const locale = candidate.settingsLocale || 'en-us';
            // eslint-disable-next-line no-await-in-loop
            await sendFirstHabitNudgeEmail({
                subject: translate(locale, 'emails.firstHabitNudge.subject'),
                locale,
                toAddresses: [candidate.email as string],
                agencyDomainName: context.whiteLabelOrigin,
                brandVariation: context.brandVariation,
            }, {
                toName: candidate.firstName || candidate.userName || '',
            });
            counters.emailed += 1;
        } catch (err: any) {
            counters.errors += 1;
            logFailure('onboarding no-habit nudge failed', err, { 'user.id': candidate.userId });
        }
    }

    return counters;
};

const runInviterResend = async (
    queuePush: QueueRecapFn,
    context: IOnboardingNurtureContext,
    now: Date,
    names: ReturnType<typeof createNameResolvers>,
): Promise<IOnboardingMessageCounters> => {
    const counters = emptyMessageCounters();
    const seats = await Store.onboardingMessages.getUnclaimedSeatsForInviter(
        new Date(now.getTime() - NUDGE_MIN_AGE_HOURS * MS_PER_HOUR),
        new Date(now.getTime() - NUDGE_MAX_AGE_DAYS * MS_PER_DAY),
        INVITER_RESEND_SUFFIX,
        ONBOARDING_NURTURE_MAX_ROWS,
    );
    counters.evaluated = seats.length;
    counters.capped = seats.length >= ONBOARDING_NURTURE_MAX_ROWS;

    // One prompt per inviter per run: rows are oldest first, so their oldest unanswered invite goes
    // now and the rest wait for a later run (each is still prompted about at most once).
    const seenCreators = new Set<string>();
    const firstPerCreator = seats.filter((seat) => {
        if (seenCreators.has(seat.creatorUserId)) {
            counters.deferredSameUser += 1;
            return false;
        }
        seenCreators.add(seat.creatorUserId);
        return true;
    });

    const { preferencesByUserId, withDevice } = await loadPushReach(
        context.brandVariation,
        firstPerCreator.map((seat) => seat.creatorUserId),
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const seat of firstPerCreator) {
        try {
            const preferences = preferencesByUserId[seat.creatorUserId] || {};
            if (!withDevice.has(seat.creatorUserId) || preferences.settingsPushHabitReminders === false) {
                counters.noChannel += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            const messageKey = seatMessageKey(seat.pactMemberId, INVITER_RESEND_SUFFIX);
            // eslint-disable-next-line no-await-in-loop
            if (!(await Store.onboardingMessages.claim(seat.creatorUserId, messageKey, 'push'))) {
                counters.deduped += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            const partnerName = await names.getUserDisplayName(seat.inviteeUserId);
            const schedule = resolveReminderSchedule(preferences, now, { jitterSeed: seat.creatorUserId });
            // eslint-disable-next-line no-await-in-loop
            const outcome = await queuePush(
                seat.creatorUserId,
                PushNotifications.Types.pactInviteUnclaimed,
                messageKey,
                {
                    pactId: seat.pactId,
                    habitName: seat.habitGoalName || '',
                    partnerName,
                },
                schedule.morningAt,
            );
            counters[outcomeCounter(outcome)] += 1;
        } catch (err: any) {
            counters.errors += 1;
            logFailure('onboarding inviter resend prompt failed', err, {
                'pactMember.id': seat.pactMemberId,
                'user.id': seat.creatorUserId,
            });
        }
    }

    return counters;
};

const runSeatReminders = async (
    context: IOnboardingNurtureContext,
    now: Date,
    names: ReturnType<typeof createNameResolvers>,
): Promise<IOnboardingMessageCounters> => {
    const counters = emptyMessageCounters();
    // eslint-disable-next-line no-restricted-syntax
    for (const reminder of SEAT_REMINDERS) {
        // eslint-disable-next-line no-await-in-loop
        const seats = await Store.onboardingMessages.getExpiringEmailSeats(
            now,
            new Date(now.getTime() - reminder.minAgeDays * MS_PER_DAY),
            new Date(now.getTime() - reminder.maxAgeDays * MS_PER_DAY),
            reminder.suffix,
            ONBOARDING_NURTURE_MAX_ROWS,
        );
        counters.evaluated += seats.length;
        counters.capped = counters.capped || seats.length >= ONBOARDING_NURTURE_MAX_ROWS;

        // eslint-disable-next-line no-restricted-syntax
        for (const seat of seats) {
            try {
                if (!seat.email || seat.isUnclaimed || seat.settingsEmailInvites === false) {
                    counters.noChannel += 1;
                    // eslint-disable-next-line no-continue
                    continue;
                }

                // eslint-disable-next-line no-await-in-loop
                if (!(await Store.onboardingMessages.claim(seat.inviteeUserId, seatMessageKey(seat.pactMemberId, reminder.suffix), 'email'))) {
                    counters.deduped += 1;
                    // eslint-disable-next-line no-continue
                    continue;
                }

                // eslint-disable-next-line no-await-in-loop
                const fromName = await names.getUserDisplayName(seat.creatorUserId);
                const daysLeft = Math.max(1, Math.ceil((new Date(seat.claimTokenExpiresAt).getTime() - now.getTime()) / MS_PER_DAY));
                const locale = seat.settingsLocale || 'en-us';
                // eslint-disable-next-line no-await-in-loop
                await sendPactSeatReminderEmail({
                    subject: translate(locale, 'emails.pactSeatReminder.subject', { fromName }),
                    locale,
                    toAddresses: [seat.email],
                    agencyDomainName: context.whiteLabelOrigin,
                    brandVariation: context.brandVariation,
                }, {
                    fromName,
                    toName: seat.firstName || '',
                    habitName: seat.habitGoalName || '',
                    claimUrl: buildPactClaimUrl(context.whiteLabelOrigin, context.brandVariation, seat.claimToken),
                    claimCode: seat.claimCode || '',
                    daysLeft,
                });
                counters.emailed += 1;
            } catch (err: any) {
                counters.errors += 1;
                logFailure('onboarding seat reminder failed', err, { 'pactMember.id': seat.pactMemberId });
            }
        }
    }

    return counters;
};

const runFounderOffer = async (
    queuePush: QueueRecapFn,
    context: IOnboardingNurtureContext,
    now: Date,
): Promise<IOnboardingNurtureCounters['founderOffer']> => {
    const counters: IOnboardingNurtureCounters['founderOffer'] = { ...emptyMessageCounters(), skippedSoldOut: false, skippedEntitled: 0 };
    // The offer is only true while founder spots remain. Read once per run; the cap is 5,000 and
    // a run sends a handful, so a sell-out mid-run is not worth a read per user.
    const claimed = await Store.lifetimePurchases.countClaimedFounderSlots();
    if (claimed >= HABITS_LIFETIME_FOUNDER_LIMIT) {
        counters.skippedSoldOut = true;
        return counters;
    }

    const candidates = await Store.onboardingMessages.getFounderOfferCandidates(
        context.brandVariation,
        FOUNDER_OFFER_MESSAGE_KEY,
        new Date(now.getTime() - FOUNDER_OFFER_MIN_AGE_DAYS * MS_PER_DAY),
        FOUNDER_OFFER_MIN_CHECKINS,
        ONBOARDING_NURTURE_MAX_ROWS,
    );
    counters.evaluated = candidates.length;
    counters.capped = candidates.length >= ONBOARDING_NURTURE_MAX_ROWS;

    const eligible = candidates.filter((candidate) => {
        if (isHabitCapExempt(context.brandVariation, candidate.accessLevels || [])) {
            counters.skippedEntitled += 1;
            return false;
        }
        return true;
    });
    const { preferencesByUserId, withDevice } = await loadPushReach(context.brandVariation, eligible.map((c) => c.userId));

    // eslint-disable-next-line no-restricted-syntax
    for (const candidate of eligible) {
        try {
            const preferences = preferencesByUserId[candidate.userId] || {};
            // An offer is marketing, so it answers to the marketing switch as well as the habits one.
            if (!withDevice.has(candidate.userId)
                || preferences.settingsPushHabitReminders === false
                || candidate.settingsPushMarketing === false) {
                counters.noChannel += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            if (!(await Store.onboardingMessages.claim(candidate.userId, FOUNDER_OFFER_MESSAGE_KEY, 'push'))) {
                counters.deduped += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            const schedule = resolveReminderSchedule(preferences, now, { jitterSeed: candidate.userId });
            // eslint-disable-next-line no-await-in-loop
            const outcome = await queuePush(
                candidate.userId,
                PushNotifications.Types.habitsFounderOffer,
                FOUNDER_OFFER_MESSAGE_KEY,
                { checkinCount: candidate.completedCheckins },
                schedule.morningAt,
            );
            counters[outcomeCounter(outcome)] += 1;
        } catch (err: any) {
            counters.errors += 1;
            logFailure('onboarding founder offer failed', err, { 'user.id': candidate.userId });
        }
    }

    return counters;
};

/**
 * Runs the four messages in turn. Each is best-effort on its own: one failing is logged and
 * counted, and the others still run.
 */
export const runOnboardingNurturePass = async (
    queuePush: QueueRecapFn,
    context: IOnboardingNurtureContext,
    now: Date = new Date(),
): Promise<IOnboardingNurtureCounters> => {
    if (!isOnboardingNurtureEnabled()) {
        return emptyOnboardingNurtureCounters();
    }

    // The same naming rule as every other habits push, memoized across the passes.
    const names = createNameResolvers();
    const failed = (message: string) => (err: any) => {
        logFailure(message, err, {});
        return { ...emptyMessageCounters(), errors: 1 };
    };

    return {
        noHabitNudge: await runNoHabitNudge(queuePush, context, now)
            .catch(failed('the onboarding no-habit nudge failed')),
        inviterResend: await runInviterResend(queuePush, context, now, names)
            .catch(failed('the onboarding inviter resend prompt failed')),
        seatReminders: await runSeatReminders(context, now, names)
            .catch(failed('the onboarding seat reminders failed')),
        founderOffer: await runFounderOffer(queuePush, context, now)
            .catch((err: any) => ({ ...failed('the onboarding founder offer failed')(err), skippedSoldOut: false, skippedEntitled: 0 })),
    };
};
