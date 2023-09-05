import * as socketio from 'socket.io';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import redisSessions from '../store/redisSessions';
import notifyConnections from '../utilities/notify-connections';
import { UserStatus } from '../constants';

export interface ILoginData {
    idToken: string;
    userName: string;
    firstName: string;
    lastName: string;
    id: string;
}

interface IUpdateSessionnArgs {
    appName: string;
    socket: socketio.Socket;
    data: {
        details: ILoginData;
        socketDetails: any;
        isAuthenticated: boolean;
    };
}

const update = ({
    appName,
    socket,
    data,
}: IUpdateSessionnArgs, decodedAuthenticationToken: any) => {
    const user = data.details;
    const socketDetails = data.socketDetails;

    logSpan({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${user.userName} with socketId ${socket.id}, has refreshed the page. Updating socket.`,
        traceArgs: {
            ip: (socket.handshake.headers as any).host.split(':')[0],
            'socket.id': socket.id,
            'user.userName': user.userName,
            'user.firstName': user.firstName,
            'user.lastName': user.lastName,
            'socket.previousSocketId': socketDetails.session.id,
        },
    });

    if (socket.handshake && (socket.handshake.headers as any) && (socket.handshake.headers as any).host && data.isAuthenticated) {
        redisSessions.update({
            app: appName,
            socketId: socket.id,
            ip: (socket.handshake.headers as any).host.split(':')[0],
            // 30 minutes
            ttl: 60 * 1000 * 30,
            data: {
                id: user.id,
                socketId: socket.id,
                previousSocketId: socketDetails.session.id || null,
                userName: user.userName,
                firstName: user.firstName,
                lastName: user.lastName,
                idToken: user.idToken,
                status: UserStatus.ACTIVE,
            },
        }).then((response: any) => {
            notifyConnections(
                socket,
                { ...user, status: UserStatus.ACTIVE },
                SocketServerActionTypes.ACTIVE_CONNECTION_REFRESHED,
                true,
                decodedAuthenticationToken,
            );
            socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                type: SocketServerActionTypes.SESSION_UPDATED,
                data: {
                    ...response,
                    status: UserStatus.ACTIVE,
                },
            });
        }).catch((err: any) => {
            logSpan({
                level: 'verbose',
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err.toString(),
                traceArgs: {
                    appName,
                    ip: (socket.handshake.headers as any).host.split(':')[0],
                    'socket.id': socket.id,
                    'user.userName': user.userName,
                },
            });
        });
    }
};

export default update;
