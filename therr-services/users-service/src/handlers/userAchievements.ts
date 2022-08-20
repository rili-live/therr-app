import { RequestHandler } from 'express';
import { achievementsByClass } from 'therr-js-utilities/config';
import { Notifications } from 'therr-js-utilities/constants';
import Store from '../store';
import { IDBAchievement } from '../store/UserAchievementsStore';
import createSendTotalNotification from '../utilities/createSendTotalNotification';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';

// CREATE
const updateAndCreateUserAchievements: RequestHandler = async (req: any, res: any) => {
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
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

    return Store.userAchievements.get({
        userId,
        achievementTier,
        achievementClass,
    }).then((results) => {
        const sortedResults = results.sort((a, b) => a.achievementTier - b.achievementTier);
        const latestAch: IDBAchievement = sortedResults[sortedResults.length - 1];
        const achievementsInClass = achievementsByClass[achievementClass];
        const tierAchievementKeys = Object.keys(achievementsInClass)
            .filter((key:string) => achievementsInClass[key].tier === achievementTier);
        const tierAchievementsArr = tierAchievementKeys.map((key) => ({ ...achievementsInClass[key], id: key }));

        return Store.userAchievements.updateAndCreateConsecutive({
            userId,
            achievementClass,
            achievementTier,
        }, progressCount, tierAchievementsArr, latestAch);
    })
        .then((result) => {
            [...result.created, ...result.updated].forEach((achievement) => {
                // NOTE: Does not include e-mail because scheduler will e-mail users
                // who have not claimed rewards
                createSendTotalNotification({
                    authorization,
                    locale,
                }, {
                    userId,
                    type: Notifications.Types.ACHIEVEMENT_COMPLETED,
                    associationId: achievement.id,
                    isUnread: true,
                    messageLocaleKey: Notifications.MessageKeys.ACHIEVEMENT_COMPLETED,
                }, {
                    toUserId: userId,
                    fromUser: {
                        id: userId,
                    },
                });
            });
            return res.status(201).send(result);
        })
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

export {
    updateAndCreateUserAchievements,
    getUserAchievements,
};
