import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { checkHabitCapacity } from './helpers/habitCapacity';

/**
 * Personal ("solo") habits — habits tracked without an accountability partner.
 *
 * Friends with Habits is built around pacts, and inviting someone is still the
 * flow the product leads with. It is no longer a *precondition* for tracking
 * anything, though. Solo habits were previously gated on having already sent a
 * pact invite, which left the app with no way to start a habit at all for
 * someone who did not want to involve a friend: the only creation flow was the
 * pact wizard, the wizard refused to advance without an invitee, and solo
 * tracking refused to unlock without an invite already sent. The invite
 * requirement was the entirety of the onboarding, so that circle had no exit.
 *
 * Starting a habit alone is therefore unconditional now, subject only to the
 * free-tier habit cap that governs pact habits equally. The growth loop moves
 * from a gate to a prompt — the wizard still asks for partners first, and the
 * dashboard still surfaces pacts — which is the trade this makes deliberately.
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
 * The only thing standing between a user and a personal habit is the free-tier
 * cap. There is deliberately no invite prerequisite — see the note at the top
 * of this file for why that gate was removed.
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
 * Where the caller stands against the free-tier cap.
 *
 * The client needs this before it can decide whether to render the "track on my
 * own" affordance at all, and deriving it from other endpoints is how the
 * mobile and server answers drift apart.
 *
 * `canCreateSolo` is now always true and is kept only so that app builds
 * already in the wild — which hide the solo affordance unless the server says
 * yes — start offering it the moment this deploys, without waiting on a store
 * release. Treat it as deprecated: nothing should branch on it in new code.
 */
const getSoloEligibility: RequestHandler = async (req: any, res: any) => {
    const { locale, userId, brandVariation } = parseHeaders(req.headers);

    try {
        const [activeHabitCount, denial] = await Promise.all([
            Store.userHabits.countActiveByUser(userId),
            checkHabitCapacity({ userId, brandVariation, locale }),
        ]);

        return res.status(200).send({
            canCreateSolo: true,
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
