import { getSearchQueryString } from 'therr-js-utilities/http';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import restRequest from './restRequest';
import redisSessions from '../store/redisSessions';
import globalConfig from '../../../../global-config';

// TODO: Optimize for performance
// eslint-disable-next-line default-param-last
export default (socket, userDetails, actionType, shouldReturnActiveConnections = false, decodedAuthenticationToken: any) => {
    const query = {
        filterBy: 'acceptingUserId',
        query: userDetails.id,
        itemsPerPage: 50,
        pageNumber: 1,
        orderBy: 'interactionCount',
        order: 'desc',
        shouldCheckReverse: true,
    };
    let queryString = getSearchQueryString(query);

    if (query.shouldCheckReverse) {
        queryString = `${queryString}&shouldCheckReverse=true`;
    }

    return restRequest({
        method: 'get',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users/connections${queryString}`,
    }, socket, decodedAuthenticationToken).then(({
        data: searchResults,
    }) => {
        const users = searchResults && searchResults.results
            .map((connection) => {
                const contextUserId = connection.users[0].id === userDetails.id ? connection.users[1].id : connection.users[0].id;
                return connection.users.find((user) => user.id === contextUserId);
            });

        return redisSessions.getUsersByIds(users).then((cachedActiveUsers) => {
            const activeUsers: any[] = [];
            users.forEach((u) => {
                const mappedMatch = cachedActiveUsers.find((activeUser) => activeUser.id === u.id);
                if (mappedMatch) {
                    activeUsers.push({
                        ...u,
                        ...mappedMatch,
                    });
                }
            });

            if (shouldReturnActiveConnections) {
                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED,
                    data: {
                        activeUsers,
                    },
                });
            }

            activeUsers.forEach((activeUser) => {
                socket.broadcast.to(activeUser.socketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: actionType,
                    data: {
                        id: userDetails.id,
                        userName: userDetails.userName,
                        firstName: userDetails.firstName,
                        lastName: userDetails.lastName,
                        status: userDetails.status,
                        socketId: socket.id,
                    },
                });
            });
        });
    }).catch((err) => {
        logSpan({
            level: 'error',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: err.toString(),
            traceArgs: {
                'error.message': err?.message,
                source: 'notify-connections',
            },
        });
    });
};
