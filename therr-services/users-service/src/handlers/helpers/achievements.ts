import { achievementsByClass } from 'therr-js-utilities/config';
import { Notifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { ICreateOrUpdateResponse, IDBAchievement } from '../../store/UserAchievementsStore';
import notifyUserOfUpdate from '../../utilities/notifyUserOfUpdate';

const getAchIdNumber = (id: string) => {
    const arr = id.split('_');
    arr.shift();
    return parseInt(arr.join(''), 10);
};

interface IRequesterDetails {
    authorization?: string;
    userId: string;
    locale: string;
    whiteLabelOrigin: string;
}

const createOrUpdateAchievement: (requesterDetails: IRequesterDetails, requestBody: any) => Promise<ICreateOrUpdateResponse> = ({
    authorization,
    userId,
    locale,
    whiteLabelOrigin,
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
        const sortedResults = results.sort((a, b) => getAchIdNumber(a.achievementId) - getAchIdNumber(b.achievementId));
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
                    notifyUserOfUpdate({
                        authorization,
                        locale,
                        whiteLabelOrigin,
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
