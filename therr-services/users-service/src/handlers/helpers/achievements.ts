import { achievementsByClass, isAchievementClassEnabledForBrand } from 'therr-js-utilities/config';
import { Notifications } from 'therr-js-utilities/constants';
import { getBrandContext } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import Store from '../../store';
import { ICreateOrUpdateResponse, IDBAchievement } from '../../store/UserAchievementsStore';
import notifyUserOfUpdate from '../../utilities/notifyUserOfUpdate';

const NO_OP_RESPONSE: ICreateOrUpdateResponse = {
    created: [],
    updated: [],
    action: 'incomplete',
};

const getAchIdNumber = (id: string) => {
    const arr = id.split('_');
    arr.shift();
    return parseInt(arr.join(''), 10);
};

const createOrUpdateAchievement: (
    requesterDetails: InternalConfigHeaders,
    requestBody: any,
) => Promise<ICreateOrUpdateResponse> = (headers: InternalConfigHeaders, {
    achievementClass,
    achievementTier,
    progressCount,
}) => {
    if (!achievementsByClass[achievementClass]) {
        return Promise.reject(Error('invalid-achievement-class'));
    }

    const { brandVariation } = getBrandContext(headers as Record<string, any>);

    // Skip when the achievement class isn't enabled for the request's brand. For example,
    // a HABITS user creating a connection would otherwise trigger 'socialite_1_1' and write
    // a Therr-themed row stamped with brandVariation='habits' — it passes the SQL brand
    // filter but surfaces a Therr-shaped achievement (and ACHIEVEMENT_COMPLETED push) in
    // the niche app. The HABITS class allow-list (see therr-js-utilities/config/achievements)
    // now also includes the 8 streak/pact-themed classes plus reused `socialite` for invites.
    if (!isAchievementClassEnabledForBrand(achievementClass, brandVariation)) {
        return Promise.resolve(NO_OP_RESPONSE);
    }

    return Store.userAchievements.get(brandVariation, {
        userId: headers['x-userid'] || '',
        achievementTier,
        achievementClass,
    }).then((results) => {
        const sortedResults = results.sort((a, b) => getAchIdNumber(a.achievementId) - getAchIdNumber(b.achievementId));
        const latestAch: IDBAchievement = sortedResults[sortedResults.length - 1];
        const achievementsInClass = achievementsByClass[achievementClass];
        const tierAchievementKeys = Object.keys(achievementsInClass)
            .filter((key:string) => achievementsInClass[key].tier === achievementTier);
        const tierAchievementsArr = tierAchievementKeys.map((key) => ({ ...achievementsInClass[key], id: key }));

        return Store.userAchievements.updateAndCreateConsecutive(brandVariation, {
            userId: headers['x-userid'] || '',
            achievementClass,
            achievementTier,
        }, progressCount, tierAchievementsArr, latestAch);
    })
        .then((result) => {
            [...result.created, ...result.updated].forEach((achievement) => {
                // NOTE: Does not include e-mail because scheduler will e-mail users
                // who have not claimed rewards
                if (headers.authorization && achievement.completedAt) {
                    notifyUserOfUpdate(headers, {
                        userId: headers['x-userid'] || '',
                        type: Notifications.Types.ACHIEVEMENT_COMPLETED,
                        associationId: achievement.id,
                        isUnread: true,
                        messageLocaleKey: Notifications.MessageKeys.ACHIEVEMENT_COMPLETED,
                    }, {
                        toUserId: headers['x-userid'] || '',
                    }, {
                        shouldCreateDBNotification: true,
                        shouldSendPushNotification: true,
                        shouldSendEmail: true,
                    }).catch((err) => logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Failed to send ACHIEVEMENT_COMPLETED notification'],
                        traceArgs: {
                            'error.message': err?.message,
                        },
                    }));
                }
            });

            return result;
        });
};

export {
    createOrUpdateAchievement,
};
