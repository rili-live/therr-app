import { Notifications, PushNotifications } from 'therr-js-utilities/constants';
import { ICreateNotificationParams } from '../store/NotificationsStore';
import Store from '../store';
import sendEmailAndOrPushNotification from './sendEmailAndOrPushNotification';

interface IHeaders {
    authorization: string;
    locale: string;
    whiteLabelOrigin: string;
}

interface IEmailAndPushParams {
    toUserId: string;
    fromUser: {
        id: string;
        name?: string;
    };
    fromUserNames?: string[];
    retentionEmailType?: PushNotifications.Types;
    groupName?: string;
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
                // Fire and forget
                sendEmailAndOrPushNotification(Store.users.findUser, {
                    authorization: headers.authorization,
                    fromUserName: emailAndPushParams.fromUser?.name,
                    fromUserId: emailAndPushParams.fromUser?.id,
                    locale: headers.locale,
                    toUserId: emailAndPushParams.toUserId,
                    type: pushNotificationType,
                    whiteLabelOrigin: headers.whiteLabelOrigin,
                    retentionEmailType: emailAndPushParams.retentionEmailType,
                    groupName: emailAndPushParams.groupName,
                    fromUserNames: emailAndPushParams.fromUserNames,
                }, {
                    shouldSendPushNotification: config.shouldSendPushNotification,
                    shouldSendEmail: config.shouldSendEmail,
                });
            }

            return notification;
        });
};
