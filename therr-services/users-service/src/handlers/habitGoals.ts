import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { validateSavingsTargetInput } from '../utilities/savingsProgress';
import { hasCadenceChanged } from '../utilities/habitCadence';

// CREATE
const createHabitGoal: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);

    const {
        name,
        description,
        category,
        emoji,
        goalType,
        frequencyType,
        frequencyCount,
        targetDaysOfWeek,
        isPublic,
    } = req.body;

    if (!name) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitGoals.nameRequired'),
            statusCode: 400,
        });
    }

    // Validated, not silently dropped: a savings target the user typed and the server
    // ignored is money they believe they are tracking and are not.
    const savings = validateSavingsTargetInput(req.body);
    if (savings.errorKey) {
        return handleHttpError({
            res,
            message: translate(locale, savings.errorKey),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    return Store.habitGoals.create({
        name,
        description,
        category,
        emoji,
        goalType,
        frequencyType,
        frequencyCount,
        targetDaysOfWeek,
        createdByUserId: userId,
        isTemplate: false,
        isPublic: isPublic || false,
        ...savings.params,
    })
        .then((habitGoal) => res.status(201).send(habitGoal))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_GOALS_ROUTES:ERROR' }));
};

// READ
const getHabitGoal: RequestHandler = async (req: any, res: any) => {
    const { id } = req.params;

    return Store.habitGoals.getById(id)
        .then((habitGoal) => {
            if (!habitGoal) {
                return handleHttpError({
                    res,
                    message: `Habit goal not found with id ${id}`,
                    statusCode: 404,
                });
            }
            return res.status(200).send(habitGoal);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_GOALS_ROUTES:ERROR' }));
};

const getUserHabitGoals: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { limit, offset } = req.query;

    return Store.habitGoals.getByUserId(
        userId,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined,
    )
        .then((habitGoals) => res.status(200).send(habitGoals))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_GOALS_ROUTES:ERROR' }));
};

const getTemplates: RequestHandler = async (req: any, res: any) => {
    const { category, limit, offset } = req.query;

    return Store.habitGoals.getTemplates(
        category,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined,
    )
        .then((templates) => res.status(200).send(templates))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_GOALS_ROUTES:ERROR' }));
};

const getPublicGoals: RequestHandler = async (req: any, res: any) => {
    const { category, limit, offset } = req.query;

    return Store.habitGoals.getPublicGoals(
        category,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined,
    )
        .then((goals) => res.status(200).send(goals))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_GOALS_ROUTES:ERROR' }));
};

const searchHabitGoals: RequestHandler = async (req: any, res: any) => {
    const { query, limit } = req.query;

    if (!query) {
        return handleHttpError({
            res,
            message: 'Search query is required',
            statusCode: 400,
        });
    }

    return Store.habitGoals.searchByName(
        query,
        limit ? parseInt(limit, 10) : 20,
    )
        .then((results) => res.status(200).send(results))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_GOALS_ROUTES:ERROR' }));
};

// UPDATE
const updateHabitGoal: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    const {
        name,
        description,
        category,
        emoji,
        goalType,
        frequencyType,
        frequencyCount,
        targetDaysOfWeek,
        isPublic,
    } = req.body;

    // Verify ownership
    const existingGoal = await Store.habitGoals.getById(id);
    if (!existingGoal) {
        return handleHttpError({
            res,
            message: `Habit goal not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (existingGoal.createdByUserId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitGoals.notOwner'),
            statusCode: 403,
        });
    }

    if (existingGoal.isTemplate) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitGoals.cannotModifyTemplate'),
            statusCode: 403,
        });
    }

    const savings = validateSavingsTargetInput(req.body);
    if (savings.errorKey) {
        return handleHttpError({
            res,
            message: translate(locale, savings.errorKey),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    // A cadence change governs from today forward and never re-judges days lived under the old
    // one — see migration 20260920000002 and `countMissedPeriods`. Only a change in meaning
    // stamps it; an edit that merely resends the same cadence leaves history evaluable.
    const cadenceEffectiveFrom = hasCadenceChanged(existingGoal, { frequencyType, frequencyCount, targetDaysOfWeek })
        ? new Date().toISOString().slice(0, 10)
        : undefined;

    return Store.habitGoals.update(id, {
        name,
        description,
        category,
        emoji,
        goalType,
        frequencyType,
        frequencyCount,
        targetDaysOfWeek,
        isPublic,
        cadenceEffectiveFrom,
        ...savings.params,
    })
        .then((habitGoal) => res.status(200).send(habitGoal))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_GOALS_ROUTES:ERROR' }));
};

// DELETE
const deleteHabitGoal: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.habitGoals.delete(id, userId)
        .then((deleted) => {
            if (!deleted) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.habitGoals.cannotDelete'),
                    statusCode: 403,
                });
            }
            return res.status(200).send({ deleted: true });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_GOALS_ROUTES:ERROR' }));
};

export {
    createHabitGoal,
    getHabitGoal,
    getUserHabitGoals,
    getTemplates,
    getPublicGoals,
    searchHabitGoals,
    updateHabitGoal,
    deleteHabitGoal,
};
