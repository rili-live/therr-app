import * as socketio from 'socket.io';
import printLogs from 'therr-js-utilities/print-logs';
import {
    Notifications,
} from 'therr-js-utilities/constants';
import beeline from '../beeline';
import restRequest from '../utilities/restRequest';
import redisHelper from '../utilities/redisHelper';
import globalConfig from '../../../../global-config';

const sendReactionPushNotification = (socket: socketio.Socket, data: any, decodedAuthenticationToken: any) => {
    // Send new moment/space reaction notification
    const areaReaction = data.momentReaction || data.spaceReaction;
    // const areaType = data.momentReaction ? 'moments' : 'spaces';
    if (areaReaction.userHasLiked || areaReaction.userHasSuperLiked) {
        // TODO: Handle various reaction types, and consider websocket messages to notify active users
        redisHelper.throttleReactionNotifications(data.areaUserId, areaReaction.userId)
            .then((shouldCreateNotification) => {
                if (shouldCreateNotification) { // fire and forget
                    return restRequest({
                        method: 'post',
                        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users/notifications`,
                        data: {
                            userId: data.areaUserId,
                            type: areaReaction.userHasSuperLiked ? Notifications.Types.NEW_SUPER_LIKE_RECEIVED : Notifications.Types.NEW_LIKE_RECEIVED,
                            associationId: null,
                            isUnread: true,
                            messageLocaleKey: areaReaction.userHasSuperLiked
                                ? Notifications.MessageKeys.NEW_SUPER_LIKE_RECEIVED
                                : Notifications.MessageKeys.NEW_LIKE_RECEIVED,
                            messageParams: {
                                userName: data.reactorUserName,
                            },
                            shouldSendPushNotification: true,
                            fromUserName: data.reactorUserName,
                        },
                    }, socket, decodedAuthenticationToken).catch((err) => {
                        console.log(err);
                    });
                }
            }).catch((err) => {
                console.log(err);
            });
    }
};

export {
    sendReactionPushNotification,
};
