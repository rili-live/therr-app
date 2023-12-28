import { RequestHandler } from 'express';
import { achievementsByClass } from 'therr-js-utilities/config';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { createOrUpdateAchievement } from './helpers/achievements';

// CREATE
const updateAndCreateUserAchievements: RequestHandler = async (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        achievementClass,
        achievementTier,
        progressCount,
    } = req.body;

    if (!achievementsByClass[achievementClass]) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.userAchievements.invalidAchievementClass'),
            statusCode: 400,
        });
    }

    return createOrUpdateAchievement({
        authorization,
        userId,
        locale,
        whiteLabelOrigin,
    }, {
        achievementClass,
        achievementTier,
        progressCount,
    }).then((result) => res.status(201).send(result)).catch((err) => handleHttpError({
        err,
        res,
        message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR',
    }));
};

// READ
const getUserAchievements = (req, res) => Store.userAchievements.get({
    userId: req.headers['x-userid'],
})
    .then((results) => res.status(200).send(results))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));

// READ
const claimAchievement = (req, res) => {
    const userId = req.headers['x-userid'];

    return Store.userAchievements.get({
        id: req.params.id,
        userId,
    })
        .then((results) => {
            if (!results.length) {
                return handleHttpError({
                    res,
                    message: 'NotFound',
                    statusCode: 404,
                });
            }

            if (!results[0].completedAt) {
                return handleHttpError({
                    res,
                    message: 'IncompleteAchievement',
                    statusCode: 400,
                });
            }

            if (results[0].unclaimedRewardPts <= 0) {
                return handleHttpError({
                    res,
                    message: 'AlreadyClaimed',
                    statusCode: 400,
                });
            }

            return Store.users.updateUser({
                settingsTherrCoinTotal: results[0].unclaimedRewardPts,
            }, {
                id: userId,
            }).then(() => Store.userAchievements.update(req.params.id, {
                unclaimedRewardPts: 0,
            }).then((updatedResults) => res.status(200).send(updatedResults[0])));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

export {
    updateAndCreateUserAchievements,
    getUserAchievements,
    claimAchievement,
};
