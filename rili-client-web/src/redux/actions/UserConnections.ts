import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import { UserConnectionActionTypes } from 'types/userConnections';
import UserConnectionsService from '../../services/UserConnectionsService';

const UserConnection = {
    search: (query: any) => (dispatch: any) => UserConnectionsService.search(query).then((response) => {
        dispatch({
            type: UserConnectionActionTypes.GET_USER_CONNECTIONS,
            data: response.data.results,
        });
    }),
    update: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.UPDATE_USER_CONNECTION,
            data,
        });
    },
};

export default UserConnection;
