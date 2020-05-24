import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import { UserConnectionActionTypes } from '../types/userConnections';
import UserConnectionsService from '../../services/UserConnectionsService';

const UserConnection = {
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
    create: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.CREATE_USER_CONNECTION,
            data,
        });
    },
    update: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.UPDATE_USER_CONNECTION,
            data,
        });
    },
};

export default UserConnection;
