import { Notifications, PushNotifications } from 'therr-js-utilities/constants';
import { ICreateNotificationParams } from '../store/NotificationsStore';
import Store from '../store';
import sendEmailAndOrPushNotification, { ISendPushNotification } from './sendEmailAndOrPushNotification';

interface IHeaders {
    authorization: string;
    locale: string;
    whiteLabelOrigin: string;
    brandVariation: string;
}

interface IEmailAndPushParams extends PushNotifications.INotificationData {
    toUserId: string;
    fromUser?: {
        id: string;
        userName: string;
        name: string;
    };
    fromUserNames?: string[];
    retentionEmailType?: PushNotifications.Types;
}

const getPushNotificationType = (notificationType: Notifications.Types): PushNotifications.Types => {
    let pushNotificationType = PushNotifications.Types.newDirectMessage;

    if (notificationType === Notifications.Types.NEW_LIKE_RECEIVED) {
        pushNotificationType = PushNotifications.Types.newLikeReceived;
    } else if (notificationType === Notifications.Types.ACHIEVEMENT_COMPLETED) {
        pushNotificationType = PushNotifications.Types.achievementCompleted;
    } else if (notificationType === Notifications.Types.NEW_SUPER_LIKE_RECEIVED) {
        pushNotificationType = PushNotifications.Types.newSuperLikeReceived;
    } else if (notificationType === Notifications.Types.THOUGHT_REPLY) {
        pushNotificationType = PushNotifications.Types.newThoughtReplyReceived;
    } else if (notificationType === Notifications.Types.NEW_GROUP_MEMBERS) {
        pushNotificationType = PushNotifications.Types.newGroupMembers;
    } else if (notificationType === Notifications.Types.NEW_GROUP_INVITE) {
        pushNotificationType = PushNotifications.Types.newGroupInvite;
    }

    return pushNotificationType;
};

interface INotifyUserOfUpdateConfig {
    shouldCreateDBNotification?: boolean;
    shouldSendPushNotification?: boolean;
    shouldSendEmail?: boolean;
}

export default (
    headers: IHeaders,
    dbNotification: ICreateNotificationParams,
    emailAndPushParams: IEmailAndPushParams,
    config: INotifyUserOfUpdateConfig = {
        shouldCreateDBNotification: true,
        shouldSendPushNotification: false,
        shouldSendEmail: false,
    },
): Promise<{
    messageLocaleKey: string;
    messageParams?: any;
}|undefined> => {
    const dbNotificationPromise = config.shouldCreateDBNotification
        ? Store.notifications.createNotification({
            userId: dbNotification.userId,
            type: dbNotification.type, // DB Notification type
            associationId: dbNotification.associationId, // userConnections.id, forum.id, etc.
            isUnread: dbNotification.isUnread,
            messageLocaleKey: dbNotification.messageLocaleKey,
            messageParams: dbNotification.messageParams,
        })
        : Promise.resolve([]);

    return dbNotificationPromise
        .then(([notification]) => {
            const notificationType = dbNotification.type;
            const pushNotificationType = getPushNotificationType(notificationType);

            // TODO: Handle additional notification types (currently only handles DM notification)
            if (config.shouldSendPushNotification || config.shouldSendEmail) {
                const pushNotificationParams: ISendPushNotification = {
                    ...emailAndPushParams,
                    authorization: headers.authorization,
                    locale: headers.locale,
                    type: pushNotificationType,
                    whiteLabelOrigin: headers.whiteLabelOrigin,
                    brandVariation: headers.brandVariation,
                };
                if (dbNotification.messageParams?.areaId) {
                    pushNotificationParams.area = {
                        id: dbNotification.messageParams?.areaId,
                        fromUserId: dbNotification.messageParams?.contentUserId,
                    };
                    pushNotificationParams.postType = dbNotification.messageParams?.postType;
                }
                if (dbNotification.messageParams?.thoughtId) {
                    pushNotificationParams.thought = {
                        id: dbNotification.messageParams?.thoughtId,
                        fromUserId: dbNotification.messageParams?.contentUserId,
                    };
                    pushNotificationParams.postType = dbNotification.messageParams?.postType;
                }
                // Fire and forget
                sendEmailAndOrPushNotification(Store.users.findUser, pushNotificationParams, {
                    shouldSendPushNotification: config.shouldSendPushNotification,
                    shouldSendEmail: config.shouldSendEmail,
                });
            }

            return notification;
        });
};
