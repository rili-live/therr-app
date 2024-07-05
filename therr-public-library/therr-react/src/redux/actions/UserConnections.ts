import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { UserConnectionActionTypes } from '../../types/redux/userConnections';
import UserConnectionsService from '../../services/UserConnectionsService';
import { UserActionTypes } from '../../types/redux/user';

const UserConnections = {
    search: (query: any, userId: number) => (dispatch: any) => UserConnectionsService.search(query).then((response) => {
        dispatch({
            type: SocketClientActionTypes.LOAD_ACTIVE_CONNECTIONS,
            data: {
                connections: response.data.results,
                userId,
            },
        });
        dispatch({
            type: UserConnectionActionTypes.GET_USER_CONNECTIONS,
            data: response.data.results,
        });
    }),
    create: (data: any, user) => (dispatch: any) => UserConnectionsService.create(data).then((response) => {
        dispatch({
            type: SocketClientActionTypes.CREATE_USER_CONNECTION,
            data: {
                connection: response && response.data,
                user,
            },
        });
        return Promise.resolve(response?.data);
    }),
    update: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.UPDATE_USER_CONNECTION,
            data,
        });
    },
    updateType: (otherUserId: number, type: 1 | 2 | 3 | 4 | 5) => (dispatch: any) => UserConnectionsService
        .updateType(otherUserId, type).then((response) => {
            dispatch({
                type: UserActionTypes.UPDATE_USER_IN_VIEW,
                data: {
                    connectionType: type,
                },
            });
            return Promise.resolve(response?.data);
        }),
};

export default UserConnections;
