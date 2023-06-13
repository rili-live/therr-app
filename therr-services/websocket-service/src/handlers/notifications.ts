import { Socket } from 'socket.io';
import printLogs from 'therr-js-utilities/print-logs';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import beeline from '../beeline';
import globalConfig from '../../../../global-config';
import restRequest from '../utilities/restRequest';

interface IUpdateNotificationData {
    notification: any;
    userName: string;
}

const updateNotification = (socket: Socket, data: IUpdateNotificationData, decodedAuthenticationToken: any) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data?.userName} with socketId ${socket.id}, updated a notification`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
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
        printLogs({
            level: 'error',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: err.toString(),
            tracer: beeline,
            traceArgs: {
                errorMessage: err?.message,
                source: 'updateNotification',
            },
        });
    });
};

export default updateNotification;
