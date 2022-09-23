import { achievementsByClass } from 'therr-js-utilities/config';
import { Notifications } from 'therr-js-utilities/constants';
import Store from '../../store';
import { ICreateOrUpdateResponse, IDBAchievement } from '../../store/UserAchievementsStore';
import createSendTotalNotification from '../../utilities/createSendTotalNotification';

const createOrUpdateAchievement: (requesterDetails: any, requestBody: any) => Promise<ICreateOrUpdateResponse> = ({
    authorization,
    userId,
    locale,
}, {
    achievementClass,
    achievementTier,
    progressCount,
}) => {
    if (!achievementsByClass[achievementClass]) {
        return Promise.reject(Error('invalid-achievement-class'));
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
                if (authorization && achievement.completedAt) {
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
                    }, true);
                }
            });

            return result;
        });
};

export {
    createOrUpdateAchievement,
};
