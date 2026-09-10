import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { isUserInPact } from '../utilities/pactHelpers';
import { PactActivityType } from '../store/PactActivitiesStore';
import {
    awardSocialEnergizerReactionAchievement,
    awardSocialEnergizerCelebrationAchievement,
} from './helpers/awardHabitAchievements';

const REACTION_TYPES: PactActivityType[] = ['reaction_added', 'encouragement_sent'];
const CELEBRATION_TYPES: PactActivityType[] = ['celebration_sent'];

const createActivity: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { pactId } = req.params;
    const {
        activityType, targetUserId, checkinId, data,
    } = req.body;

    if (!activityType) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.activityTypeRequired'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    const pact = await Store.pacts.getById(pactId);
    if (!pact) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (!isUserInPact(userId, pact.creatorUserId, pact.partnerUserId)) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notParticipant'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    return Store.pactActivities.create({
        pactId,
        userId,
        targetUserId,
        activityType: activityType as PactActivityType,
        checkinId,
        data,
    })
        .then((activity) => {
            if (REACTION_TYPES.includes(activityType)) {
                awardSocialEnergizerReactionAchievement(req.headers, 1);
            }
            if (CELEBRATION_TYPES.includes(activityType)) {
                awardSocialEnergizerCelebrationAchievement(req.headers, 1);
            }
            return res.status(201).send(activity);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACT_ACTIVITIES_ROUTES:ERROR' }));
};

const getActivitiesByPactId: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { pactId } = req.params;
    const { limit, offset } = req.query;

    const pact = await Store.pacts.getById(pactId);
    if (!pact) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (!isUserInPact(userId, pact.creatorUserId, pact.partnerUserId)) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notParticipant'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    return Store.pactActivities.getByPactId(
        pactId,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined,
    )
        .then((rows) => res.status(200).send(rows))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACT_ACTIVITIES_ROUTES:ERROR' }));
};

export {
    createActivity,
    getActivitiesByPactId,
};
