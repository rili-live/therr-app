import { RequestHandler } from 'express';
import { achievements } from 'therr-js-utilities/config';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';

// CREATE
const createUserAchievement: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const {
        achievementId,
        progressCount,
    } = req.body;

    if (!achievements[achievementId]) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.userAchievements.invalidAchievementId'),
            statusCode: 400,
        });
    }

    return Store.userAchievements.create({
        achievementId,
        userId,
        progressCount,
    })
        .then((userAchievements) => res.status(201).send(userAchievements[0]))
        .catch((err) => handleHttpError({
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

// UPDATE
const updateUserAchievement = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const { id } = req.params;
    const {
        achievementId,
        count,
    } = req.body;

    if (!achievements[achievementId]) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.userAchievements.invalidAchievementId'),
            statusCode: 400,
        });
    }
    return Store.userAchievements.get({
        achievementId,
        userId,
    })
        .then((userAchievements) => {
            if (!userAchievements.length) {
                return handleHttpError({
                    res,
                    message: 'NotFound',
                    statusCode: 404,
                });
            }

            return Store.userAchievements.update(id, count)
                .then((results) => res.status(200).send(results));
        })
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR',
        }));
};

export {
    createUserAchievement,
    getUserAchievements,
    updateUserAchievement,
};
