import { getSearchQueryString } from 'rili-js-utilities/http';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'rili-js-utilities/constants';
import restRequest from './restRequest';
import redisSessions from '../store/redisSessions';
import globalConfig from '../../../../global-config';

// TODO: Optimizing for performance
export default (socket, userDetails, actionType, shouldReturnActiveConnections = false) => {
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
    }, socket).then(({
        data: searchResults,
    }) => {
        const users = searchResults && searchResults.results
            .map((connection) => {
                const contextUserId = connection.acceptingUserId === userDetails.id ? connection.requestingUserId : connection.acceptingUserId;
                return connection.users.find((user) => user.id === contextUserId);
            });

        redisSessions.getUsersByIds(users).then((cachedActiveUsers) => {
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
    });
};
