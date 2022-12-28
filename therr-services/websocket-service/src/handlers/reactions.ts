import * as socketio from 'socket.io';
import {
    Notifications,
} from 'therr-js-utilities/constants';
import restRequest from '../utilities/restRequest';
import redisHelper from '../utilities/redisHelper';
import globalConfig from '../../../../global-config';

// TODO: Handle various reaction types, and consider websocket messages to notify active users
const throttleAndNotify = (socket, decodedAuthenticationToken, {
    contentId,
    contentUserId,
    reactorUserId,
    reactorUserName,
    userHasSuperLiked,
}, isArea) => {
    redisHelper.throttleReactionNotifications(contentUserId, reactorUserId)
        .then((shouldCreateNotification) => {
            if (shouldCreateNotification) { // fire and forget
                return restRequest({
                    method: 'post',
                    url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users/notifications`,
                    data: {
                        userId: contentUserId,
                        type: userHasSuperLiked ? Notifications.Types.NEW_SUPER_LIKE_RECEIVED : Notifications.Types.NEW_LIKE_RECEIVED,
                        associationId: null,
                        isUnread: true,
                        messageLocaleKey: userHasSuperLiked
                            ? Notifications.MessageKeys.NEW_SUPER_LIKE_RECEIVED
                            : Notifications.MessageKeys.NEW_LIKE_RECEIVED,
                        messageParams: isArea ? {
                            areaId: contentId,
                            userName: reactorUserName,
                        } : {
                            thoughtId: contentId,
                            userName: reactorUserName,
                        },
                        shouldSendPushNotification: true,
                        fromUserName: reactorUserName,
                    },
                }, socket, decodedAuthenticationToken).catch((err) => {
                    console.log(err);
                });
            }
        }).catch((err) => {
            console.log(err);
        });
};

// TODO: Notify when user bookmarks a moment/space/thought
const sendReactionPushNotification = (socket: socketio.Socket, data: any, decodedAuthenticationToken: any) => {
    // Send new moment/space reaction notification
    const areaReaction = data.momentReaction || data.spaceReaction;
    const thoughtReaction = data.thoughtReaction;
    // const areaType = data.momentReaction ? 'moments' : 'spaces';
    if (areaReaction?.userHasLiked || areaReaction?.userHasSuperLiked) {
        throttleAndNotify(socket, decodedAuthenticationToken, {
            contentId: areaReaction.momentId || areaReaction.spaceId,
            contentUserId: data.areaUserId,
            reactorUserId: areaReaction.userId,
            reactorUserName: data.reactorUserName,
            userHasSuperLiked: areaReaction.userHasSuperLiked,
        }, true);
    } else if (thoughtReaction?.userHasLiked || thoughtReaction?.userHasSuperLiked) {
        throttleAndNotify(socket, decodedAuthenticationToken, {
            contentId: thoughtReaction.thoughtId,
            contentUserId: data.thoughtUserId,
            reactorUserId: thoughtReaction.userId,
            reactorUserName: data.reactorUserName,
            userHasSuperLiked: thoughtReaction.userHasSuperLiked,
        }, false);
    }
};

export {
    sendReactionPushNotification,
};
