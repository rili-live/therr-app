import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';

// CREATE
const createHabitGoal: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);

    const {
        name,
        description,
        category,
        emoji,
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

    return Store.habitGoals.create({
        name,
        description,
        category,
        emoji,
        frequencyType,
        frequencyCount,
        targetDaysOfWeek,
        createdByUserId: userId,
        isTemplate: false,
        isPublic: isPublic || false,
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

    return Store.habitGoals.update(id, {
        name,
        description,
        category,
        emoji,
        frequencyType,
        frequencyCount,
        targetDaysOfWeek,
        isPublic,
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
