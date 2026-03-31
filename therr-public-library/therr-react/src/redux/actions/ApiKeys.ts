import { ApiKeysService } from '../../services';
import { ApiKeyActionTypes } from '../../types/redux/apiKeys';

const ApiKeys = {
    list: () => (dispatch: any) => ApiKeysService.list().then((response: any) => {
        dispatch({
            type: ApiKeyActionTypes.GET_API_KEYS,
            data: response.data,
        });

        return response?.data;
    }).catch((err) => { console.log(err); throw err; }),

    create: (data: { name?: string }) => (dispatch: any) => ApiKeysService.create(data).then((response: any) => {
        dispatch({
            type: ApiKeyActionTypes.CREATE_API_KEY,
            data: response.data,
        });

        return response?.data;
    }).catch((err) => { console.log(err); throw err; }),

    revoke: (id: string) => (dispatch: any) => ApiKeysService.revoke(id).then((response: any) => {
        dispatch({
            type: ApiKeyActionTypes.REVOKE_API_KEY,
            data: response.data,
        });

        return response?.data;
    }).catch((err) => { console.log(err); throw err; }),
};

export default ApiKeys;
