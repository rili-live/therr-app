import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import {
    IUserHabitDetail,
    IUserHabitNotificationPreferences,
    USER_HABIT_NOTIFICATION_PREFERENCE_KEYS,
} from '../store/UserHabitsStore';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { checkHabitCapacity, getHabitCapacityStatus } from './helpers/habitCapacity';
import {
    getSoloInviteProgress,
    ISoloInviteProgress,
    SOLO_GRACE_DAYS,
    SOLO_GRACE_KEEP_INVITE_COUNT,
    spendSoloGraceIfNeeded,
} from './helpers/soloHabitAccess';
import { describeWeekProgress, getCadence } from '../utilities/habitCadence';
import { attachAmountTotals } from './helpers/savings';
import resolveWeekBounds from './helpers/weekBounds';

/**
 * Personal ("solo") habits — habits tracked without an accountability partner.
 *
 * Friends with Habits is built on the principle that you do not keep a habit
 * alone; the invite is the app's growth loop. Solo habits keep the requirement
 * and change its shape: rather than one invite acting as a toll on the way in,
 * it takes `HABITS_SOLO_UNLOCK_INVITE_COUNT` distinct people, and the client
 * shows progress toward it. A requirement the user can see coming is something
 * to finish; an invisible one is just a wall.
 *
 * The one exception is the first solo habit, which needs no invite for
 * `SOLO_GRACE_DAYS` and one invite to keep after that (see
 * `helpers/soloHabitAccess.ts` and #3010): the ask comes once there is a streak
 * worth protecting, not before the first check-in.
 *
 * Two things this deliberately does NOT do:
 *
 *   - It does not wait on acceptance. The bar is invites *sent*, so a friend
 *     who never installs the app cannot strand the inviter.
 *   - It does not gate pact habits. Anyone can create a habit with a partner
 *     from the first minute; the threshold only unlocks tracking *alone*.
 *
 * See `getSoloInviteProgress` for what counts and why it fails closed.
 */

/**
 * Attach "where you stand in your week" to each habit.
 *
 * Derived server-side rather than by the client, because deciding what a cadence asks for is
 * exactly the rule `utilities/habitCadence.ts` exists to own — a second implementation on the
 * client is the failure that module was created to delete. The client renders what it is told.
 *
 * Omitted entirely when the tally is NULL (no resolvable week). A client must read its absence
 * as "unknown", never as zero.
 */
const withWeekProgress = (userHabits: IUserHabitDetail[], today?: string) => userHabits.map((habit) => {
    if (!today || habit.completionsEarlierThisWeek === null || habit.completionsEarlierThisWeek === undefined) {
        return habit;
    }

    return {
        ...habit,
        weekProgress: describeWeekProgress(
            getCadence(habit),
            today,
            Number(habit.completionsEarlierThisWeek) || 0,
        ),
    };
});

/**
 * The 403 every solo refusal sends. The counts ride along so the client can render how far off
 * the user is without a second round trip — this response is what it draws the "invite N more
 * friends" state from.
 */
const sendSoloLocked = (res: any, locale: string, soloProgress: ISoloInviteProgress) => res.status(403).send({
    error: 'solo-locked',
    message: translate(locale, 'errorMessages.habits.soloLocked', {
        remaining: soloProgress.requiredCount - soloProgress.invitedCount,
        required: soloProgress.requiredCount,
    }),
    invitedCount: soloProgress.invitedCount,
    requiredCount: soloProgress.requiredCount,
});

// READ
const getUserHabits: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { status, timeZone } = req.query;

    if (status && status !== 'active' && status !== 'archived') {
        return handleHttpError({
            res,
            message: 'status must be one of: active, archived',
            statusCode: 400,
        });
    }

    const weekBounds = await resolveWeekBounds(userId, timeZone);

    return Store.userHabits.getDetailByUser(userId, status, weekBounds)
        .then(attachAmountTotals)
        .then((userHabits) => res.status(200).send({
            userHabits: withWeekProgress(userHabits, weekBounds?.today),
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_HABITS_ROUTES:ERROR' }));
};

// CREATE
/**
 * Start tracking a habit personally.
 *
 * Accepts either an existing `habitGoalId` (picked from the template list) or
 * an inline `goal` to create and track in one call. The second form exists
 * because the mobile flow reaches this from the pact wizard's "track this on my
 * own" branch, where the user has already composed a custom habit and a
 * two-request dance would leave an orphan goal behind if the second call failed.
 *
 * Gated on the solo unlock (see the note at the top of this file) and then on
 * the free-tier cap. The unlock is checked first: being short of the invite
 * threshold is not a paywall, and offering to sell a habit slot to someone who
 * could have the feature for free by inviting a friend is the wrong answer.
 */
const createUserHabit: RequestHandler = async (req: any, res: any) => {
    const { locale, userId, brandVariation } = parseHeaders(req.headers);
    const { habitGoalId, goal } = req.body;

    if (!habitGoalId && !goal?.name) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habits.habitGoalRequired'),
            statusCode: 400,
        });
    }

    try {
        const soloProgress = await getSoloInviteProgress(userId);

        // The cap counts *active* tracking rows, so a habit already being tracked
        // actively occupies its slot already and re-starting it consumes nothing.
        // Checking capacity unconditionally would 402 a user at the limit for
        // re-tapping a habit they are already doing — a paywall in front of a
        // no-op. An archived row is a different case: restoring it does take a
        // slot, so it must still be gated.
        //
        // Only meaningful when an existing goal was named. An inline goal is new
        // by construction, so there is nothing to already be tracking.
        const existingTracking = habitGoalId
            ? await Store.userHabits.getByUserAndHabit(userId, habitGoalId)
            : undefined;
        const isAlreadyTrackingActively = existingTracking?.status === 'active';
        // Re-starting the habit the grace was spent on is not a second solo start.
        const isGraceHabit = !!existingTracking && soloProgress.soloGrace?.userHabitId === existingTracking.id;

        if (!soloProgress.canCreateSolo && !isGraceHabit) {
            return sendSoloLocked(res, locale, soloProgress);
        }

        // Checked before anything is written — see the note on `checkHabitCapacity`
        // about why the tracking row must not exist yet when the count is taken.
        // Re-starting an archived habit revives its row without re-stamping
        // `startedAt`, so it is a restore as far as the start window goes.
        if (!isAlreadyTrackingActively) {
            const denial = await checkHabitCapacity({
                userId,
                brandVariation,
                locale,
                countsAsStart: existingTracking?.status !== 'archived',
            });

            if (denial) {
                return res.status(402).send(denial);
            }
        }

        let resolvedGoalId = habitGoalId;

        if (!resolvedGoalId) {
            const createdGoal = await Store.habitGoals.create({
                name: goal.name,
                description: goal.description,
                category: goal.category,
                emoji: goal.emoji,
                goalType: goal.goalType,
                frequencyType: goal.frequencyType,
                frequencyCount: goal.frequencyCount,
                targetDaysOfWeek: goal.targetDaysOfWeek,
                createdByUserId: userId,
                isTemplate: false,
                isPublic: false,
            });
            resolvedGoalId = createdGoal.id;
        } else {
            const existingGoal = await Store.habitGoals.getById(resolvedGoalId);

            if (!existingGoal) {
                return handleHttpError({
                    res,
                    message: `Habit goal not found with id ${resolvedGoalId}`,
                    statusCode: 404,
                });
            }
        }

        const userHabit = await Store.userHabits.getOrCreate(userId, resolvedGoalId);

        // Spent after the row exists because the grace marks a row. A start that lost the grace
        // to a concurrent one is refused like any other locked start, and a row this request
        // created is archived rather than left behind as an unpaid-for solo habit.
        if (!isGraceHabit && !(await spendSoloGraceIfNeeded(soloProgress, userHabit))) {
            if (!existingTracking) {
                await Store.userHabits.setStatus(userHabit.id, userId, 'archived');
            }
            return sendSoloLocked(res, locale, { ...soloProgress, isGraceAvailable: false, canCreateSolo: false });
        }

        // A habit the user had archived and is now starting again comes back
        // through this path rather than through restore, because from their
        // point of view they are adding a habit, not undoing an archive. The
        // capacity check above already covered the slot.
        if (userHabit.status === 'archived') {
            await Store.userHabits.setStatus(userHabit.id, userId, 'active');
        }

        // The streak ladder is created eagerly so the dashboard has something to
        // render before the first check-in, matching what pact acceptance does.
        await Store.streaks.getOrCreate(userId, resolvedGoalId);

        const weekBounds = await resolveWeekBounds(userId, req.body?.timeZone);
        const [detail] = await Store.userHabits.getDetailByUser(userId, 'active', weekBounds)
            .then((rows) => withWeekProgress(
                rows.filter((row) => row.habitGoalId === resolvedGoalId),
                weekBounds?.today,
            ));

        return res.status(201).send(detail || userHabit);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:USER_HABITS_ROUTES:ERROR' });
    }
};

// UPDATE
/**
 * Archive a tracked habit. This is the free escape hatch for a user at the
 * habit cap, so it must never be lossy: the row stays, and every check-in,
 * streak and journal entry attached to the habit goal survives untouched.
 */
const archiveUserHabit: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.userHabits.setStatus(id, userId, 'archived')
        .then(async (updated) => {
            if (updated) {
                return res.status(200).send(updated);
            }

            // Either the habit belongs to someone else, or it is already
            // archived. Distinguish them so a double-tap is a no-op rather than
            // a confusing 404.
            const existing = await Store.userHabits.getById(id);

            if (!existing || existing.userId !== userId) {
                return handleHttpError({
                    res,
                    message: `Habit not found with id ${id}`,
                    statusCode: 404,
                });
            }

            return res.status(200).send(existing);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_HABITS_ROUTES:ERROR' }));
};

const restoreUserHabit: RequestHandler = async (req: any, res: any) => {
    const { locale, userId, brandVariation } = parseHeaders(req.headers);
    const { id } = req.params;

    const existing = await Store.userHabits.getById(id);

    if (!existing || existing.userId !== userId) {
        return handleHttpError({
            res,
            message: `Habit not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (existing.status === 'active') {
        return res.status(200).send(existing);
    }

    // Restoring occupies a slot, so it is gated on the active cap like starting
    // one. It is not a start — `startedAt` is left alone — so the start window
    // does not apply: a user who has used their starts can still bring an
    // archived habit back into a free slot.
    const denial = await checkHabitCapacity({
        userId, brandVariation, locale, countsAsStart: false,
    });

    if (denial) {
        return res.status(402).send(denial);
    }

    return Store.userHabits.setStatus(id, userId, 'active')
        .then((updated) => res.status(200).send(updated || existing))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_HABITS_ROUTES:ERROR' }));
};

/**
 * Commit to a habit whose invite went unanswered as a personal ("solo") one.
 *
 * The situation this exists for: a user creates a habit with a partner, invites
 * someone, nobody accepts — and meanwhile the daily reminders fire as if it were
 * an ordinary habit they signed up to do alone. The dashboard offers two ways
 * out, this and archive. Archiving mutes the habit and keeps the invite open to
 * auto-revive on acceptance; "continue solo" is the other choice — stop waiting
 * on anyone and keep the habit, alone.
 *
 * So it does two things:
 *
 *   1. Enforces the solo-habit constraint. Tracking a habit alone is gated the
 *      same way every solo habit is (see `getSoloInviteProgress` and the note
 *      atop this file): by the invite threshold, or by spending the first-habit
 *      grace on this habit. A user with neither gets the same 403 `solo-locked`
 *      the create path returns, with progress, so the client can render
 *      "invite N more, or archive" rather than a dead end. Having sent the
 *      unanswered invite already covers SOLO_GRACE_KEEP_INVITE_COUNT, so a habit
 *      continued on the grace never locks.
 *   2. Abandons the outstanding invite(s). This is what makes the two options
 *      genuinely distinct: after this the habit is solo with nothing pending, so
 *      it stops being surfaced as "waiting on a friend" and there is nothing left
 *      to accept. (Archive, by contrast, leaves the pact pending on purpose.)
 *      The pact rows are abandoned, not deleted, so the invites still count
 *      toward the user's solo-unlock progress for their other habits.
 *
 * The tracking row is already `active` in the common case (the habit has been
 * tracked since the pact was created), so no capacity slot is consumed and none
 * is checked. The one exception is a habit the user had archived and is now
 * un-archiving into solo: reviving occupies a slot, so it is gated exactly like
 * restore.
 */
const continueSoloHabit: RequestHandler = async (req: any, res: any) => {
    const {
        locale, userId, brandVariation,
    } = parseHeaders(req.headers);
    const { id } = req.params;

    try {
        const existing = await Store.userHabits.getById(id);

        if (!existing || existing.userId !== userId) {
            return handleHttpError({
                res,
                message: `Habit not found with id ${id}`,
                statusCode: 404,
            });
        }

        // Solo constraint first. Failing closed here is deliberate: wrongly
        // letting someone bypass the invite requirement cannot be undone once the
        // habit is theirs, while wrongly denying is a retryable error on a screen
        // they are already on (mirrors createUserHabit).
        const soloProgress = await getSoloInviteProgress(userId);
        const isGraceHabit = soloProgress.soloGrace?.userHabitId === existing.id;

        if (!soloProgress.canCreateSolo && !isGraceHabit) {
            return sendSoloLocked(res, locale, soloProgress);
        }

        // Reviving an archived habit into solo takes a slot; an already-active one
        // occupies its slot already. `countActiveByUser` counts only active rows,
        // so checking before the flip is naturally safe. Like restore, it is not a
        // start, so the start window does not apply.
        if (existing.status === 'archived') {
            const denial = await checkHabitCapacity({
                userId, brandVariation, locale, countsAsStart: false,
            });

            if (denial) {
                return res.status(402).send(denial);
            }
        }

        // After the capacity check, so a 402 does not spend the grace, and before the revive, so
        // a grace lost to a concurrent start leaves the habit as it was.
        if (!isGraceHabit && !(await spendSoloGraceIfNeeded(soloProgress, existing))) {
            return sendSoloLocked(res, locale, { ...soloProgress, isGraceAvailable: false, canCreateSolo: false });
        }

        if (existing.status === 'archived') {
            await Store.userHabits.setStatus(existing.id, userId, 'active');
        }

        // Abandon the outstanding invite(s) — pending pacts this user created for
        // this goal. Abandon rather than delete so the invites keep counting
        // toward solo-unlock progress; deleting the pact_members would silently
        // re-lock the user's other habits.
        const pendingPacts = await Store.pacts.get({
            creatorUserId: userId,
            habitGoalId: existing.habitGoalId,
            status: 'pending',
        });
        await Promise.all(pendingPacts.map((pact: any) => Store.pacts.abandon(pact.id, userId, true)));

        const weekBounds = await resolveWeekBounds(userId, req.body?.timeZone);
        const [detail] = await Store.userHabits.getDetailByUser(userId, 'active', weekBounds)
            .then((rows) => withWeekProgress(
                rows.filter((row) => row.habitGoalId === existing.habitGoalId),
                weekBounds?.today,
            ));

        return res.status(200).send(detail || { ...existing, status: 'active' });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:USER_HABITS_ROUTES:ERROR' });
    }
};

/**
 * Update the per-habit notification switches.
 *
 * Why per habit rather than one more account-wide toggle: the two columns on
 * `main.users` are already all-or-nothing across every habit someone tracks, so
 * "keep the morning reminder, stop telling me to nudge my partner" had no answer
 * short of muting the app. See the migration header for the category list and
 * for why `pactNudge` — a person deliberately poking you — is not one of them.
 *
 * The body is a partial: only the keys present are written, so an older client
 * cannot reset a category it does not know about. A body with none of the four
 * keys is a 400 rather than a silent no-op — it almost always means a client
 * spelled a key wrong, and answering 200 would hide that until someone noticed
 * their setting never stuck.
 */
const updateUserHabitNotificationPreferences: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;

    const prefs = USER_HABIT_NOTIFICATION_PREFERENCE_KEYS.reduce((acc, key) => {
        if (typeof req.body?.[key] === 'boolean') {
            acc[key] = req.body[key];
        }
        return acc;
    }, {} as Partial<IUserHabitNotificationPreferences>);

    if (!Object.keys(prefs).length) {
        return handleHttpError({
            res,
            message: `Request must include at least one boolean of: ${USER_HABIT_NOTIFICATION_PREFERENCE_KEYS.join(', ')}`,
            statusCode: 400,
        });
    }

    try {
        const existing = await Store.userHabits.getById(id);

        if (!existing || existing.userId !== userId) {
            return handleHttpError({
                res,
                message: `Habit not found with id ${id}`,
                statusCode: 404,
            });
        }

        const updated = await Store.userHabits.updateNotificationPreferences(id, userId, prefs);

        return res.status(200).send(updated || existing);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:USER_HABITS_ROUTES:ERROR' });
    }
};

/**
 * Whether the caller may start habits on their own yet, how close they are to
 * earning it, and where they stand against the free-tier cap.
 *
 * The client needs all of this before it can decide what to render: not just
 * whether to show the "track on my own" affordance, but — when it is still
 * locked — the progress toward unlocking it, which is the thing that turns the
 * invite requirement into a reason to invite. Asking for it as three separate
 * derivations from other endpoints is how the mobile and server answers drift
 * apart.
 */
const getSoloEligibility: RequestHandler = async (req: any, res: any) => {
    const { locale, userId, brandVariation } = parseHeaders(req.headers);

    try {
        const [soloProgress, capacity] = await Promise.all([
            getSoloInviteProgress(userId),
            getHabitCapacityStatus({ userId, brandVariation, locale }),
        ]);

        // The limits are reported whenever they apply, not only once they have
        // been hit: the client renders "2 of 3 free habits" from them, and a
        // client that had to hardcode the numbers would drift from the server
        // the first time an env override changed them. Null means no cap
        // applies to this account (another brand, or an entitled one).
        const isCapped = !capacity.isExempt;

        return res.status(200).send({
            canCreateSolo: soloProgress.canCreateSolo,
            invitedCount: soloProgress.invitedCount,
            soloUnlockInviteCount: soloProgress.requiredCount,
            // The first-habit grace. `canCreateSolo` already includes it; these say *why*, so the
            // client can offer "start your first habit" rather than "you've unlocked solo", and
            // count down the grace on the habit it was spent on.
            isSoloGraceAvailable: soloProgress.isGraceAvailable,
            soloGrace: soloProgress.soloGrace,
            soloGraceDays: SOLO_GRACE_DAYS,
            soloGraceKeepInviteCount: SOLO_GRACE_KEEP_INVITE_COUNT,
            activeHabitCount: capacity.activeHabitCount,
            isAtHabitLimit: !!capacity.denial,
            habitLimitReason: capacity.denial?.error ?? null,
            habitLimit: isCapped ? capacity.limit : null,
            habitStartLimit: isCapped ? capacity.startLimit : null,
            habitStartWindowDays: isCapped ? capacity.startWindowDays : null,
            recentHabitStartCount: capacity.recentStartCount,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:USER_HABITS_ROUTES:ERROR' });
    }
};

export {
    getUserHabits,
    getSoloEligibility,
    createUserHabit,
    archiveUserHabit,
    restoreUserHabit,
    continueSoloHabit,
    updateUserHabitNotificationPreferences,
};
