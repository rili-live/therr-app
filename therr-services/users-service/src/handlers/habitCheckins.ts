import { RequestHandler } from 'express';
import { PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import sendEmailAndOrPushNotification from '../utilities/sendEmailAndOrPushNotification';
import {
    getTodayDateString,
    checkMilestoneReached,
} from '../utilities/streakHelpers';
import { getPartnerUserId } from '../utilities/pactHelpers';

// CREATE
const createCheckin: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const {
        pactId,
        habitGoalId,
        scheduledDate,
        status,
        notes,
        selfRating,
        difficultyRating,
    } = req.body;

    if (!habitGoalId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.habitGoalRequired'),
            statusCode: 400,
        });
    }

    const checkinDate = scheduledDate || getTodayDateString();

    // Verify habit goal exists
    const habitGoal = await Store.habitGoals.getById(habitGoalId);
    if (!habitGoal) {
        return handleHttpError({
            res,
            message: 'Habit goal not found',
            statusCode: 404,
        });
    }

    // If pact is specified, verify user is participant
    let pact;
    if (pactId) {
        pact = await Store.pacts.getById(pactId);
        if (!pact) {
            return handleHttpError({
                res,
                message: 'Pact not found',
                statusCode: 404,
            });
        }

        if (pact.creatorUserId !== userId && pact.partnerUserId !== userId) {
            return handleHttpError({
                res,
                message: 'You are not a participant in this pact',
                statusCode: 403,
            });
        }
    }

    // Create or update the checkin
    return Store.habitCheckins.createOrUpdate({
        userId,
        pactId,
        habitGoalId,
        scheduledDate: checkinDate,
        status: status || 'completed',
        completedAt: status === 'completed' ? new Date() : undefined,
        notes,
        selfRating,
        difficultyRating,
    })
        .then(async (checkin) => {
            // If completed, update streak
            if (checkin.status === 'completed') {
                const streak = await Store.streaks.getOrCreate(userId, habitGoalId, pactId);
                const streakBefore = streak.currentStreak;
                await Store.streaks.incrementStreak(streak.id, checkinDate);
                const updatedStreak = await Store.streaks.getById(streak.id);

                // Record history and check for milestone
                await Store.streaks.recordCompletion(
                    streak.id,
                    userId,
                    checkin.id,
                    checkinDate,
                    streakBefore,
                    updatedStreak.currentStreak,
                );

                const milestone = checkMilestoneReached(updatedStreak.currentStreak);
                if (milestone) {
                    await Store.streaks.recordMilestone(
                        streak.id,
                        userId,
                        checkin.id,
                        checkinDate,
                        streakBefore,
                        milestone,
                    );

                    // Send milestone notification
                    sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                        authorization,
                        fromUser: { id: userId },
                        locale,
                        toUserId: userId,
                        type: PushNotifications.Types.streakMilestone,
                        whiteLabelOrigin,
                        brandVariation,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error sending streak milestone notification'],
                            traceArgs: { 'error.message': err?.message },
                        });
                    });
                }

                // Update pact member stats if in a pact
                if (pactId) {
                    const member = await Store.pactMembers.getByPactAndUser(pactId, userId);
                    if (member) {
                        await Store.pactMembers.incrementCheckinStats(
                            member.id,
                            true,
                            updatedStreak.currentStreak,
                        );
                        await Store.pactMembers.updateCompletionRate(member.id);
                    }

                    // Notify partner
                    const partnerId = getPartnerUserId(userId, pact.creatorUserId, pact.partnerUserId);
                    if (partnerId) {
                        sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                            authorization,
                            fromUser: { id: userId },
                            locale,
                            toUserId: partnerId,
                            type: PushNotifications.Types.partnerCheckedIn,
                            whiteLabelOrigin,
                            brandVariation,
                        }).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['Error sending partner checkin notification'],
                                traceArgs: { 'error.message': err?.message },
                            });
                        });
                    }
                }

                // Mark checkin as contributing to streak
                await Store.habitCheckins.update(checkin.id, { contributedToStreak: true });
            }

            return res.status(201).send(checkin);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

// READ
const getCheckin: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.habitCheckins.getById(id)
        .then((checkin) => {
            if (!checkin) {
                return handleHttpError({
                    res,
                    message: `Checkin not found with id ${id}`,
                    statusCode: 404,
                });
            }

            // Verify ownership
            if (checkin.userId !== userId) {
                return handleHttpError({
                    res,
                    message: 'Not authorized to view this checkin',
                    statusCode: 403,
                });
            }

            return res.status(200).send(checkin);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

const getTodayCheckins: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { habitGoalId } = req.query;

    const today = getTodayDateString();

    return Store.habitCheckins.getByUserAndDate(userId, today, habitGoalId)
        .then((checkins) => res.status(200).send(checkins))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

const getCheckinsByDateRange: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { startDate, endDate, habitGoalId } = req.query;

    if (!startDate || !endDate) {
        return handleHttpError({
            res,
            message: 'startDate and endDate are required',
            statusCode: 400,
        });
    }

    return Store.habitCheckins.getByUserAndDateRange(
        userId,
        startDate,
        endDate,
        habitGoalId,
    )
        .then((checkins) => res.status(200).send(checkins))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

const getPactCheckins: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { pactId } = req.params;
    const { limit, offset } = req.query;

    // Verify user is participant in pact
    const pact = await Store.pacts.getById(pactId);
    if (!pact) {
        return handleHttpError({
            res,
            message: 'Pact not found',
            statusCode: 404,
        });
    }

    if (pact.creatorUserId !== userId && pact.partnerUserId !== userId) {
        return handleHttpError({
            res,
            message: 'You are not a participant in this pact',
            statusCode: 403,
        });
    }

    return Store.habitCheckins.getByPactId(
        pactId,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined,
    )
        .then((checkins) => res.status(200).send(checkins))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

// UPDATE
const updateCheckin: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;

    const {
        status,
        notes,
        selfRating,
        difficultyRating,
    } = req.body;

    // Verify ownership
    const existingCheckin = await Store.habitCheckins.getById(id);
    if (!existingCheckin) {
        return handleHttpError({
            res,
            message: `Checkin not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (existingCheckin.userId !== userId) {
        return handleHttpError({
            res,
            message: 'Not authorized to update this checkin',
            statusCode: 403,
        });
    }

    return Store.habitCheckins.update(id, {
        status,
        notes,
        selfRating,
        difficultyRating,
        completedAt: status === 'completed' && !existingCheckin.completedAt ? new Date() : undefined,
    })
        .then((checkin) => res.status(200).send(checkin))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

const skipCheckin: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;
    const { notes } = req.body;

    // Verify ownership
    const existingCheckin = await Store.habitCheckins.getById(id);
    if (!existingCheckin) {
        return handleHttpError({
            res,
            message: `Checkin not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (existingCheckin.userId !== userId) {
        return handleHttpError({
            res,
            message: 'Not authorized to update this checkin',
            statusCode: 403,
        });
    }

    return Store.habitCheckins.skip(id, notes)
        .then((checkin) => res.status(200).send(checkin))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

// DELETE
const deleteCheckin: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.habitCheckins.delete(id, userId)
        .then((deleted) => {
            if (!deleted) {
                return handleHttpError({
                    res,
                    message: 'Checkin not found or not authorized to delete',
                    statusCode: 404,
                });
            }
            return res.status(200).send({ deleted: true });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

export {
    createCheckin,
    getCheckin,
    getTodayCheckins,
    getCheckinsByDateRange,
    getPactCheckins,
    updateCheckin,
    skipCheckin,
    deleteCheckin,
};
