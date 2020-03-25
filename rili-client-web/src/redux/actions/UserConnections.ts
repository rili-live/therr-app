import { UserConnectionActionTypes } from 'types/userConnections';
import UserConnectionsService from '../../services/UserConnectionsService';

const UserConnection = {
    search: (query: any) => (dispatch: any) => UserConnectionsService.search(query).then((response) => {
        dispatch({
            type: UserConnectionActionTypes.GET_USER_CONNECTIONS,
            data: response.data.results,
        });
    }),
};

export default UserConnection;
