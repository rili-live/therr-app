import { RequestHandler } from 'express';
import { achievementsByClass } from 'therr-js-utilities/config';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { createOrUpdateAchievement } from './helpers/achievements';

// CREATE
const updateAndCreateUserAchievements: RequestHandler = async (req: any, res: any) => {
    const { locale } = parseHeaders(req.headers);
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

    return createOrUpdateAchievement(req.headers, {
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
const getUserAchievements = (req, res) => {
    const { brandVariation } = getBrandContext(req.headers);
    return Store.userAchievements.get(brandVariation, {
        userId: req.headers['x-userid'],
    })
        .then((results) => res.status(200).send(results))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

// READ — public variant for viewing another user's completed achievements (badges).
// Anonymous-readable: only returns rows when the target user's profile is public
// (`settingsIsProfilePublic = true` and the account is not soft-deleted). On a private
// or missing user, responds 404 to avoid disclosing existence. Strips unclaimedRewardPts
// and other private fields so a viewer never sees in-progress progress counts or pending
// point balances on a non-self profile.
const getPublicUserAchievements: RequestHandler = (req: any, res: any) => {
    const { brandVariation } = getBrandContext(req.headers);
    const targetUserId = req.params.userId;
    if (!targetUserId) {
        return handleHttpError({ res, message: 'NotFound', statusCode: 404 });
    }
    return Store.users.getUserById(
        targetUserId,
        ['id', 'settingsIsProfilePublic', 'settingsIsAccountSoftDeleted'],
    )
        .then((userRows) => {
            const target = userRows?.[0];
            if (!target || target.settingsIsAccountSoftDeleted || !target.settingsIsProfilePublic) {
                return handleHttpError({ res, message: 'NotFound', statusCode: 404 });
            }
            return Store.userAchievements.getCompleted(brandVariation, { userId: targetUserId })
                .then((results) => {
                    const sanitized = (results || []).map((row: any) => ({
                        id: row.id,
                        userId: row.userId,
                        achievementId: row.achievementId,
                        achievementClass: row.achievementClass,
                        achievementTier: row.achievementTier,
                        progressCount: row.progressCount,
                        completedAt: row.completedAt,
                    }));
                    return res.status(200).send(sanitized);
                });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

// READ
const claimAchievement = (req, res) => {
    const userId = req.headers['x-userid'];
    const { brandVariation } = getBrandContext(req.headers);

    return Store.userAchievements.get(brandVariation, {
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
            }).then(() => Store.userAchievements.update(brandVariation, req.params.id, {
                unclaimedRewardPts: 0,
            }).then((updatedResults) => res.status(200).send(updatedResults[0])));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

export {
    updateAndCreateUserAchievements,
    getUserAchievements,
    getPublicUserAchievements,
    claimAchievement,
};
