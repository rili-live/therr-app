import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { checkHabitCapacity } from './helpers/habitCapacity';
import { getSoloInviteProgress } from './helpers/soloHabitAccess';

/**
 * Personal ("solo") habits — habits tracked without an accountability partner.
 *
 * Friends with Habits is built on the principle that you do not start a habit
 * alone; that mandatory invite is the app's growth loop. Solo habits keep the
 * requirement and change its shape: rather than one invite acting as a toll on
 * the way in, it takes `HABITS_SOLO_UNLOCK_INVITE_COUNT` distinct people, and
 * the client shows progress toward it. A requirement the user can see coming is
 * something to finish; an invisible one is just a wall.
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

// READ
const getUserHabits: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { status } = req.query;

    if (status && status !== 'active' && status !== 'archived') {
        return handleHttpError({
            res,
            message: 'status must be one of: active, archived',
            statusCode: 400,
        });
    }

    return Store.userHabits.getDetailByUser(userId, status)
        .then((userHabits) => res.status(200).send({ userHabits }))
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

    const soloProgress = await getSoloInviteProgress(userId);

    if (!soloProgress.canCreateSolo) {
        // The counts ride along so the client can render how far off the user
        // is without a second round trip — this response is what it draws the
        // "invite N more friends" state from.
        return res.status(403).send({
            error: 'solo-locked',
            message: translate(locale, 'errorMessages.habits.soloLocked', {
                remaining: soloProgress.requiredCount - soloProgress.invitedCount,
                required: soloProgress.requiredCount,
            }),
            invitedCount: soloProgress.invitedCount,
            requiredCount: soloProgress.requiredCount,
        });
    }

    try {
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

        // Checked before anything is written — see the note on `checkHabitCapacity`
        // about why the tracking row must not exist yet when the count is taken.
        if (!isAlreadyTrackingActively) {
            const denial = await checkHabitCapacity({ userId, brandVariation, locale });

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

        const [detail] = await Store.userHabits.getDetailByUser(userId, 'active')
            .then((rows) => rows.filter((row) => row.habitGoalId === resolvedGoalId));

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

    // Restoring occupies a slot, so it is gated exactly like starting one.
    const denial = await checkHabitCapacity({ userId, brandVariation, locale });

    if (denial) {
        return res.status(402).send(denial);
    }

    return Store.userHabits.setStatus(id, userId, 'active')
        .then((updated) => res.status(200).send(updated || existing))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_HABITS_ROUTES:ERROR' }));
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
        const [soloProgress, activeHabitCount, denial] = await Promise.all([
            getSoloInviteProgress(userId),
            Store.userHabits.countActiveByUser(userId),
            checkHabitCapacity({ userId, brandVariation, locale }),
        ]);

        return res.status(200).send({
            canCreateSolo: soloProgress.canCreateSolo,
            invitedCount: soloProgress.invitedCount,
            soloUnlockInviteCount: soloProgress.requiredCount,
            activeHabitCount,
            isAtHabitLimit: !!denial,
            habitLimit: denial?.limit ?? null,
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
};
