import * as socketio from 'socket.io';
import logSpan from 'therr-js-utilities/log-or-update-span';
import {
    Notifications,
} from 'therr-js-utilities/constants';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { IAreaType, IPostType } from 'therr-js-utilities/types';
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
    postType,
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
                            userId: reactorUserId,
                            postType,
                        } : {
                            thoughtId: contentId,
                            userName: reactorUserName,
                            postType,
                        },
                        shouldSendPushNotification: true,
                        fromUserName: reactorUserName,
                    },
                }, socket, decodedAuthenticationToken);
            }
        }).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'WEBSOCKET_SERVICE',
                messages: JSON.stringify(err?.response?.data || { error: 'Unknown error with websocket request' }),
                traceArgs: {},
            });
        });
};

// TODO: Notify when user bookmarks a moment/space/thought
const sendReactionPushNotification = (socket: socketio.Socket, data: any, decodedAuthenticationToken: any) => {
    // Send new moment/space reaction notification
    const areaReaction = data.momentReaction || data.spaceReaction;
    const areaType: IAreaType = data.momentReaction ? 'moments' : 'spaces';
    const postType: IPostType = areaReaction ? areaType : 'thoughts';
    const thoughtReaction = data.thoughtReaction;
    if (areaReaction?.userHasLiked || areaReaction?.userHasSuperLiked) {
        throttleAndNotify(socket, decodedAuthenticationToken, {
            contentId: areaReaction.momentId || areaReaction.spaceId,
            contentUserId: data.areaUserId,
            reactorUserId: areaReaction.userId,
            reactorUserName: data.reactorUserName,
            userHasSuperLiked: areaReaction.userHasSuperLiked,
            postType,
        }, true);
    } else if (thoughtReaction?.userHasLiked || thoughtReaction?.userHasSuperLiked) {
        throttleAndNotify(socket, decodedAuthenticationToken, {
            contentId: thoughtReaction.thoughtId,
            contentUserId: data.thoughtUserId,
            reactorUserId: thoughtReaction.userId,
            reactorUserName: data.reactorUserName,
            userHasSuperLiked: thoughtReaction.userHasSuperLiked,
            postType,
        }, false);
    }
};

export {
    sendReactionPushNotification,
};
