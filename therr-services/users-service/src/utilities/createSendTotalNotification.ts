import { Notifications, PushNotifications } from 'therr-js-utilities/constants';
import { ICreateNotificationParams } from '../store/NotificationsStore';
import Store from '../store';
import sendPushNotificationAndEmail from './sendPushNotificationAndEmail';

interface IHeaders {
    authorization: string;
    locale: string;
    whiteLabelOrigin: string;
}

interface IParticipants {
    toUserId: string;
    fromUser: {
        id: string;
        name?: string;
    };
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
    }

    return pushNotificationType;
};

export default (
    headers: IHeaders,
    notificationParams: ICreateNotificationParams,
    participants: IParticipants,
    shouldSendPushNotification = false,
) => Store.notifications.createNotification({
    userId: notificationParams.userId,
    type: notificationParams.type, // DB Notification type
    associationId: notificationParams.associationId,
    isUnread: notificationParams.isUnread,
    messageLocaleKey: notificationParams.messageLocaleKey,
    messageParams: notificationParams.messageParams,
})
    .then(([notification]) => {
        const notificationType = notificationParams.type;
        const pushNotificationType = getPushNotificationType(notificationType);

        // TODO: Handle additional notification types (currently only handles DM notification)
        if (shouldSendPushNotification) {
            // Fire and forget
            sendPushNotificationAndEmail(Store.users.findUser, {
                authorization: headers.authorization,
                fromUserName: participants.fromUser.name,
                fromUserId: participants.fromUser.id,
                locale: headers.locale,
                toUserId: participants.toUserId,
                type: pushNotificationType,
                whiteLabelOrigin: headers.whiteLabelOrigin,
            });
        }

        return notification;
    });
