import * as socketio from 'socket.io';
import printLogs from 'therr-js-utilities/print-logs';
import moment from 'moment';
import {
    Notifications,
    SocketServerActionTypes,
    SocketClientActionTypes,
    SOCKET_MIDDLEWARE_ACTION,
} from 'therr-js-utilities/constants';
import beeline from '../beeline';
import restRequest from '../utilities/restRequest';
import redisHelper from '../utilities/redisHelper';
import globalConfig from '../../../../global-config';
import { FORUM_PREFIX } from './rooms';
import { COMMON_DATE_FORMAT } from '../constants';

const sendReactionPushNotification = (socket: socketio.Socket, data: any, decodedAuthenticationToken: any) => {
    // Send new moment/space reaction notification
    const areaReaction = data.momentReaction || data.spaceReaction;
    // const areaType = data.momentReaction ? 'moments' : 'spaces';
    if (areaReaction.userHasLiked || areaReaction.userHasSuperLiked) {
        // TODO: Handle various reaction types, and consider websocket messages to notify active users
        redisHelper.throttleReactionNotifications(data.areaUserId, areaReaction.userId)
            .then((shouldCreateNotification) => {
                if (shouldCreateNotification) { // fire and forget
                    restRequest({
                        method: 'post',
                        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users/notifications`,
                        data: {
                            userId: data.areaUserId,
                            type: Notifications.Types.NEW_LIKE_RECEIVED,
                            associationId: null,
                            isUnread: true,
                            messageLocaleKey: Notifications.MessageKeys.NEW_LIKE_RECEIVED,
                            messageParams: {
                                userName: data.reactorUserName,
                            },
                            shouldSendPushNotification: true,
                            fromUserName: data.reactorUserName,
                        },
                    }, socket, decodedAuthenticationToken);
                }
            });
    }
};

export {
    sendReactionPushNotification,
};
