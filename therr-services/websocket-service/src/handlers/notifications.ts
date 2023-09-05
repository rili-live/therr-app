import { Socket } from 'socket.io';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import globalConfig from '../../../../global-config';
import restRequest from '../utilities/restRequest';

interface IUpdateNotificationData {
    notification: any;
    userName: string;
}

const updateNotification = (socket: Socket, data: IUpdateNotificationData, decodedAuthenticationToken: any) => {
    logSpan({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data?.userName} with socketId ${socket.id}, updated a notification`,
        traceArgs: {
            'socket.id': socket.id,
        },
    });
    return restRequest({
        method: 'put',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users/notifications/${data?.notification?.id}`,
        data: {
            isUnread: data?.notification?.isUnread,
        },
    }, socket, decodedAuthenticationToken).then((response) => {
        socket.emit(SOCKET_MIDDLEWARE_ACTION, {
            type: SocketServerActionTypes.NOTIFICATION_UPDATED,
            data: {
                ...data?.notification,
                ...response.data,
            },
        });
    }).catch((err) => {
        logSpan({
            level: 'error',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: err.toString(),
            traceArgs: {
                'error.message': err?.message,
                source: 'updateNotification',
            },
        });
    });
};

export default updateNotification;
