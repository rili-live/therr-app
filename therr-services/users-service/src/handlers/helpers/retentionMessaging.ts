/**
 * Retention messaging at the measured drop-off points, inside the daily habits digest.
 *
 * Four decisions, each tied to a number in `utilities/retentionLadder.ts`:
 *
 *   | Moment                         | What the digest does                                  | Channel          | Ledger key                               |
 *   |--------------------------------|-------------------------------------------------------|------------------|------------------------------------------|
 *   | Has a habit, never checked in  | the day's nudge becomes "Day 1 of <habit>", once      | push, else email | onboarding:first-checkin                 |
 *   | First check-in was yesterday   | the day's nudge becomes "Day 2 of <habit>", once      | push, else email | retention:day-two                        |
 *   | No check-in for 3+ days        | daily nudges + partner-missed-day stop                | —                | —                                        |
 *   | …at day 3, 7 and 14            | one comeback message per rung, then silence           | push, else email | retention:comeback:<lastCheckinDate>:d<N> |
 *
 * Every message is claimed in `habits.onboarding_messages` before it is sent — the same once-ever
 * ledger the onboarding nurture sequence uses, so `onboarding:first-checkin` is the next step of
 * that sequence rather than a second one. The pushes are `dailyHabitReminder` rows stamped with
 * `payload.messageVariant`: that type is already data-only with a one-press Check In button, is
 * already wired on every installed Android build, and already passes through the worker's send-time
 * freshness gate (a comeback to someone who checked in at lunch is dropped). A new type would be
 * inert until a fresh build shipped, and would lose all three.
 *
 * Failure direction: a failed history read leaves the context empty, and an empty context backs
 * nobody off and sends no variant — the digest behaves exactly as it did before this module.
 * Silence is the failure that goes unnoticed (docs/HABIT_LIFECYCLE_MESSAGING.md § Gate invariance 2).
 */
import { BrandVariations, HabitGoalTypes, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { IRetentionProfileRow } from '../../store/OnboardingMessagesStore';
import { IUserHabitReminderRow } from '../../store/UserHabitsStore';
import sendHabitRetentionEmail from '../../api/email/for-social/sendHabitRetentionEmail';
import { ICheckinNudgeRow } from '../../utilities/checkinNudgeRollup';
import { isDailyBonusEnabled } from '../../utilities/dailyBonus';
import { EnqueueOutcome } from '../../utilities/enqueueNotification';
import { resolveReminderSchedule } from '../../utilities/localReminderSchedule';
import {
    areRetentionMessagesEnabled,
    classifyRetention,
    comebackMessageKey,
    DAY_TWO_MESSAGE_KEY,
    FIRST_CHECKIN_MESSAGE_KEY,
    getComebackLadderDays,
    getDueComebackRung,
    getLapseBackoffDays,
    IRetentionClassification,
    isBackedOff,
    isLadderExhausted,
    isLapseBackoffEnabled,
    RetentionMessageVariant,
} from '../../utilities/retentionLadder';
import { QueueRecapFn } from './weeklyRecapDigest';

export interface IRetentionMessageCounters {
    /** Push rows queued with this variant. */
    queued: number;
    emailed: number;
    /** Already claimed — an earlier run, an overlapping one, or a retry. */
    deduped: number;
    /** No device and no usable email, so nothing was claimed. */
    noChannel: number;
    errors: number;
}

/**
 * The run's tally. The digest owns one per run and every function below adds to it in place —
 * hence the no-param-reassign exemptions on those lines.
 */
export interface IRetentionCounters {
    /** Users whose check-in history was read. 0 with `profileReadFailed` false means nobody to read. */
    profilesLoaded: number;
    /** True when the history read failed and the run fell back to the pre-retention behaviour. */
    profileReadFailed: boolean;
    /**
     * Check-in nudges (one per user) dropped because the user is lapsed. The volume the back-off
     * removes, and the counter that says it is working — read it against `comeback.queued`, which
     * is what those users get instead, at most three times per lapse.
     */
    nudgesBackedOff: number;
    /** "Your partner missed a day" pushes not sent because the recipient or the subject is lapsed. */
    partnerMissedBackedOff: number;
    /** Lapsed users past the ladder's last rung. Deliberate silence, counted so it is visible. */
    ladderExhausted: number;
    /** Lapsed users skipped this run because the lifecycle engine's own `habitComeback` went out. */
    comebackYieldedToLifecycle: number;
    firstCheckin: IRetentionMessageCounters;
    dayTwo: IRetentionMessageCounters;
    comeback: IRetentionMessageCounters;
}

const emptyMessageCounters = (): IRetentionMessageCounters => ({
    queued: 0, emailed: 0, deduped: 0, noChannel: 0, errors: 0,
});

export const emptyRetentionCounters = (): IRetentionCounters => ({
    profilesLoaded: 0,
    profileReadFailed: false,
    nudgesBackedOff: 0,
    partnerMissedBackedOff: 0,
    ladderExhausted: 0,
    comebackYieldedToLifecycle: 0,
    firstCheckin: emptyMessageCounters(),
    dayTwo: emptyMessageCounters(),
    comeback: emptyMessageCounters(),
});

export interface IRetentionContext {
    today: string;
    lapseDays: number;
    ladder: number[];
    backoffEnabled: boolean;
    messagesEnabled: boolean;
    profiles: Map<string, IRetentionProfileRow>;
    classifications: Map<string, IRetentionClassification>;
}

export const EMPTY_RETENTION_CONTEXT = (today: string): IRetentionContext => ({
    today,
    lapseDays: getLapseBackoffDays(),
    ladder: getComebackLadderDays(),
    backoffEnabled: false,
    messagesEnabled: false,
    profiles: new Map(),
    classifications: new Map(),
});

const logFailure = (message: string, err: any, traceArgs: Record<string, any> = {}) => logSpan({
    level: 'error',
    messageOrigin: 'API_SERVER',
    messages: [err?.message, `Habits digest: ${message}`],
    traceArgs,
});

/**
 * One read of check-in history for everyone the run might notify. Never throws: a failure is
 * counted and yields a context that backs nobody off and sends no variant.
 */
export const loadRetentionContext = async (
    userIds: string[],
    today: string,
    counters: IRetentionCounters,
): Promise<IRetentionContext> => {
    const backoffEnabled = isLapseBackoffEnabled();
    const messagesEnabled = areRetentionMessagesEnabled();
    const empty = EMPTY_RETENTION_CONTEXT(today);
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    if ((!backoffEnabled && !messagesEnabled) || !unique.length) {
        return empty;
    }

    try {
        const rows = await Store.onboardingMessages.getRetentionProfiles(unique);
        const lapseDays = getLapseBackoffDays();
        const profiles = new Map<string, IRetentionProfileRow>();
        const classifications = new Map<string, IRetentionClassification>();
        (rows || []).forEach((row) => {
            profiles.set(row.userId, row);
            classifications.set(row.userId, classifyRetention(row, today, lapseDays));
        });
        counters.profilesLoaded = profiles.size; // eslint-disable-line no-param-reassign
        return {
            today,
            lapseDays,
            ladder: getComebackLadderDays(lapseDays),
            backoffEnabled,
            messagesEnabled,
            profiles,
            classifications,
        };
    } catch (err: any) {
        counters.profileReadFailed = true; // eslint-disable-line no-param-reassign
        logFailure('failed to read retention history; no back-off this run', err);
        return empty;
    }
};

/** True when this user's daily check-in nudges should stop. Unknown users are never backed off. */
export const isUserBackedOff = (context: IRetentionContext, userId: string): boolean => {
    if (!context.backoffEnabled) {
        return false;
    }
    const classification = context.classifications.get(userId);
    return !!classification && isBackedOff(classification);
};

const canEmail = (profile: IRetentionProfileRow | undefined): profile is IRetentionProfileRow & { email: string } => !!profile
    && !!profile.email
    && !profile.isUnclaimed
    && profile.settingsEmailReminders !== false;

/** Users among `userIds` with a device registered for the brand. A failed read assumes everyone has one. */
export const loadUsersWithDevice = async (brand: BrandVariations, userIds: string[]): Promise<Set<string> | null> => {
    if (!userIds.length) {
        return new Set();
    }
    try {
        const rows = await Store.userDeviceTokens.getTokensForUsers(brand, userIds);
        return new Set((rows || []).map((row: any) => row.userId));
    } catch (err: any) {
        logFailure('failed to read device tokens for retention messages', err);
        return null;
    }
};

const outcomeCounter = (outcome: EnqueueOutcome): 'queued' | 'deduped' | 'errors' => {
    if (outcome === 'queued') return 'queued';
    return outcome === 'duplicate' ? 'deduped' : 'errors';
};

export type NudgeRetentionDecision =
    | { action: 'backed-off' }
    | { action: 'normal' }
    | { action: 'push'; variant: RetentionMessageVariant }
    | { action: 'emailed'; variant: RetentionMessageVariant };

export interface IEmailContext {
    brandVariation: BrandVariations;
    whiteLabelOrigin: string;
}

/**
 * What the drain does with one user's check-in nudge: drop it (lapsed), send it as it is, or
 * turn it into the once-ever first-checkin / day-two message — by push when the user has a device,
 * by email otherwise. A variant is claimed before it is returned, so a re-run sends the plain
 * nudge, never a second "Day 2".
 */
export const decideNudgeRetention = async (
    row: ICheckinNudgeRow,
    context: IRetentionContext,
    usersWithDevice: Set<string> | null,
    partnerName: string | undefined,
    emailContext: IEmailContext,
    counters: IRetentionCounters,
): Promise<NudgeRetentionDecision> => {
    if (isUserBackedOff(context, row.userId)) {
        counters.nudgesBackedOff += 1; // eslint-disable-line no-param-reassign
        return { action: 'backed-off' };
    }
    if (!context.messagesEnabled) {
        return { action: 'normal' };
    }
    const classification = context.classifications.get(row.userId);
    if (!classification) {
        return { action: 'normal' };
    }

    let variant: RetentionMessageVariant | undefined;
    let messageKey = '';
    let bucket: IRetentionMessageCounters | undefined;
    if (classification.state === 'never-new') {
        variant = 'first-checkin';
        messageKey = FIRST_CHECKIN_MESSAGE_KEY;
        bucket = counters.firstCheckin;
    } else if (classification.isDayTwo) {
        variant = 'day-two';
        messageKey = DAY_TWO_MESSAGE_KEY;
        bucket = counters.dayTwo;
    }
    if (!variant || !bucket) {
        return { action: 'normal' };
    }

    const profile = context.profiles.get(row.userId);
    // A null device set means the token read failed: assume push, which is what the worker would
    // have attempted anyway.
    const hasDevice = usersWithDevice === null || usersWithDevice.has(row.userId);
    const emailable = canEmail(profile);
    if (!hasDevice && !emailable) {
        bucket.noChannel += 1;
        return { action: 'normal' };
    }

    try {
        const claimed = await Store.onboardingMessages.claim(row.userId, messageKey, hasDevice ? 'push' : 'email');
        if (!claimed) {
            bucket.deduped += 1;
            return { action: 'normal' };
        }
        if (hasDevice) {
            return { action: 'push', variant };
        }

        const locale = profile?.settingsLocale || 'en-us';
        await sendHabitRetentionEmail(variant, {
            locale,
            toAddresses: [(profile as IRetentionProfileRow).email as string],
            agencyDomainName: emailContext.whiteLabelOrigin,
            brandVariation: emailContext.brandVariation,
        }, {
            toName: profile?.firstName || profile?.userName || '',
            habitName: row.payload.habitName,
            partnerName,
        });
        bucket.emailed += 1;
        return { action: 'emailed', variant };
    } catch (err: any) {
        bucket.errors += 1;
        logFailure(`retention ${variant} message failed`, err, { 'user.id': row.userId });
        return { action: 'normal' };
    }
};

/** Count the queue outcome of a variant push the drain sent under `decideNudgeRetention`. */
export const recordVariantOutcome = (
    variant: RetentionMessageVariant,
    outcome: EnqueueOutcome,
    counters: IRetentionCounters,
): void => {
    const bucket = variant === 'first-checkin' ? counters.firstCheckin : counters.dayTwo;
    bucket[outcomeCounter(outcome)] += 1;
};

/**
 * The habit a comeback names: the one most recently checked in on, else the first one tracked.
 * Muted habits (`notifyReminders = false`) are never named — the user asked for silence on them.
 */
const selectComebackHabit = (habits: IUserHabitReminderRow[]): IUserHabitReminderRow | undefined => {
    const eligible = habits.filter((habit) => habit.notifyReminders !== false);
    if (!eligible.length) {
        return undefined;
    }
    return eligible.reduce((best, current) => {
        const bestDate = best.lastCompletedDate ? String(best.lastCompletedDate).slice(0, 10) : '';
        const currentDate = current.lastCompletedDate ? String(current.lastCompletedDate).slice(0, 10) : '';
        return currentDate > bestDate ? current : best;
    }, eligible[0]);
};

export interface IComebackLadderArgs {
    queuePush: QueueRecapFn;
    context: IRetentionContext;
    /** The digest's reminder rows — every active habit, which is the ladder's population. */
    habits: IUserHabitReminderRow[];
    /** Users the lifecycle engine already sent `habitComeback` this run. They hear one comeback, not two. */
    lifecycleComebackUsers: Set<string>;
    getPartnerName: (pactId: string | null | undefined, userId: string) => Promise<string | undefined>;
    emailContext: IEmailContext;
    counters: IRetentionCounters;
    now: Date;
}

/**
 * The comeback ladder: one message at each rung (default day 3, 7, 14 without a check-in), then
 * nothing. Runs over lapsed users only, after the drain has dropped their daily nudges, so on any
 * run a user gets the nudge or the comeback, never both.
 */
export const runComebackLadderPass = async ({
    queuePush,
    context,
    habits,
    lifecycleComebackUsers,
    getPartnerName,
    emailContext,
    counters,
    now,
}: IComebackLadderArgs): Promise<void> => {
    if (!context.backoffEnabled || !context.messagesEnabled) {
        return;
    }

    const habitsByUser = new Map<string, IUserHabitReminderRow[]>();
    habits.forEach((habit) => {
        if (!habitsByUser.has(habit.userId)) habitsByUser.set(habit.userId, []);
        (habitsByUser.get(habit.userId) as IUserHabitReminderRow[]).push(habit);
    });

    const due: { userId: string; rung: number; classification: IRetentionClassification; habit: IUserHabitReminderRow }[] = [];
    habitsByUser.forEach((userHabits, userId) => {
        const classification = context.classifications.get(userId);
        if (!classification || !isBackedOff(classification) || !classification.anchorDate) {
            return;
        }
        if (isLadderExhausted(classification.daysSince, context.ladder)) {
            counters.ladderExhausted += 1; // eslint-disable-line no-param-reassign
            return;
        }
        const rung = getDueComebackRung(classification.daysSince, context.ladder);
        const habit = selectComebackHabit(userHabits);
        if (rung === null || !habit) {
            return;
        }
        if (lifecycleComebackUsers.has(userId)) {
            counters.comebackYieldedToLifecycle += 1; // eslint-disable-line no-param-reassign
            return;
        }
        due.push({
            userId, rung, classification, habit,
        });
    });
    if (!due.length) {
        return;
    }

    const userIds = due.map((entry) => entry.userId);
    const [preferences, usersWithDevice] = await Promise.all([
        Store.users.getHabitReminderPreferences(userIds).catch((err: any) => {
            logFailure('failed to read reminder preferences for the comeback ladder', err);
            return {} as Record<string, any>;
        }),
        loadUsersWithDevice(emailContext.brandVariation, userIds),
    ]);
    const bonusOnOffer = isDailyBonusEnabled();

    // eslint-disable-next-line no-restricted-syntax
    for (const {
        userId, rung, classification, habit,
    } of due) {
        const bucket = counters.comeback;
        try {
            const prefs = (preferences as Record<string, any>)[userId] || {};
            const profile = context.profiles.get(userId);
            const hasDevice = (usersWithDevice === null || usersWithDevice.has(userId)) && prefs.settingsPushHabitReminders !== false;
            const emailable = canEmail(profile);
            if (!hasDevice && !emailable) {
                bucket.noChannel += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            let variant: RetentionMessageVariant = 'fresh-start';
            if (classification.state === 'lapsed') {
                variant = bonusOnOffer ? 'comeback' : 'comeback-no-bonus';
            }
            const messageKey = comebackMessageKey(classification.anchorDate as string, rung);
            // eslint-disable-next-line no-await-in-loop
            if (!(await Store.onboardingMessages.claim(userId, messageKey, hasDevice ? 'push' : 'email'))) {
                bucket.deduped += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            const partnerName = await getPartnerName(habit.activePactId, userId);

            if (hasDevice) {
                const schedule = resolveReminderSchedule(prefs, now, { jitterSeed: userId });
                const isSavings = habit.goalType === HabitGoalTypes.SAVINGS_GOAL;
                // eslint-disable-next-line no-await-in-loop
                const outcome = await queuePush(
                    userId,
                    PushNotifications.Types.dailyHabitReminder,
                    messageKey,
                    {
                        messageVariant: variant,
                        comebackRung: rung,
                        habitName: habit.goalName,
                        habitNames: [habit.goalName],
                        habitCount: 1,
                        habitGoalId: habit.habitGoalId,
                        pactId: habit.activePactId || undefined,
                        partnerName,
                        isSavingsGoal: isSavings ? true : undefined,
                        currencyCode: isSavings ? habit.currencyCode || undefined : undefined,
                        // The freshness gate's inputs: a user who checks in between the digest and
                        // this morning slot is not told to come back.
                        habitGoalIds: [habit.habitGoalId],
                        checkinDate: schedule.morningLocalDate,
                    },
                    schedule.morningAt,
                );
                bucket[outcomeCounter(outcome)] += 1;
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            await sendHabitRetentionEmail(variant, {
                locale: profile?.settingsLocale || 'en-us',
                toAddresses: [(profile as IRetentionProfileRow).email as string],
                agencyDomainName: emailContext.whiteLabelOrigin,
                brandVariation: emailContext.brandVariation,
            }, {
                toName: profile?.firstName || profile?.userName || '',
                habitName: habit.goalName,
                partnerName,
            });
            bucket.emailed += 1;
        } catch (err: any) {
            bucket.errors += 1;
            logFailure('retention comeback message failed', err, { 'user.id': userId });
        }
    }
};
