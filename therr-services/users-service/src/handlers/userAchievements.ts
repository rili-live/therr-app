import { RequestHandler } from 'express';
import { achievements, achievementsByClass } from 'therr-js-utilities/config';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';

type IResultAction = 'incomplete'
    | 'achievement-tier-completed'
    | 'achievement-tier-already-complete'
    | 'created-first-of-tier'
    | 'created-next-of-tier'
    | 'updated-in-progress';

interface ICreateOrUpdateResponse {
    created: any|never[];
    updated: any|never[];
    action: IResultAction;
}

const createNextAchievement: (userId: string, achievement: { class: string, tier: string }, latestAch: any, progressCount: number) =>
Promise<ICreateOrUpdateResponse> = (
    userId,
    achievement,
    latestAch,
    progressCount,
) => {
    const achievementsInClass = achievementsByClass[achievement.class];
    const tierAchievementKeys = Object.keys(achievementsInClass)
        .filter((key:string) => achievementsInClass[key].tier === achievement.tier);

    let nextAchievementId;
    let nextAchievement;
    let action: IResultAction = 'incomplete';

    if (!latestAch || latestAch.completedAt) {
        if (!latestAch) {
            nextAchievementId = tierAchievementKeys[0];
            nextAchievement = achievementsInClass[nextAchievementId];
            action = 'created-first-of-tier';
        } else if (latestAch.completedAt) {
            const lastCompleteAchIndex = tierAchievementKeys
                .findIndex((key: string) => key === latestAch.achievementId);
            // Last of tier
            if (lastCompleteAchIndex >= tierAchievementKeys.length) {
                return Promise.resolve({ created: [], updated: {}, action: 'achievement-tier-already-complete' });
            }
            nextAchievementId = tierAchievementKeys[lastCompleteAchIndex + 1];
            nextAchievement = achievementsInClass[nextAchievementId];
            action = 'created-next-of-tier';
        }

        return Store.userAchievements.create({
            userId,
            achievementId: nextAchievementId,
            achievementClass: achievement.class,
            achievementTier: achievement.tier,
            progressCount,
            completedAt: progressCount >= nextAchievement.countToComplete ? new Date() : undefined,
        }).then((results) => ({
            created: results,
            updated: [],
            action,
        }));
    }

    // Update existing
    action = 'updated-in-progress';

    return Store.userAchievements.update(latestAch.id, progressCount).then((results) => ({
        created: [],
        updated: results,
        action,
    }));
};

// CREATE
const createOrUpdateUserAchievement: RequestHandler = async (req: any, res: any) => {
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
        const latestAch = sortedResults[sortedResults.length - 1];

        return createNextAchievement(
            userId,
            {
                class: achievementClass,
                tier: achievementTier,
            },
            latestAch,
            progressCount,
        );
    })
        .then((result) => res.status(201).send(result))
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
    createOrUpdateUserAchievement,
    getUserAchievements,
    updateUserAchievement,
};
