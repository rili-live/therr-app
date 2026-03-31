import { produce } from 'immer';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IApiKeysState, ApiKeyActionTypes } from '../../types/redux/apiKeys';

const initialState: IApiKeysState = {
    apiKeys: [],
};

const apiKeys = produce((draft: IApiKeysState, action: any) => {
    switch (action.type) {
        case ApiKeyActionTypes.GET_API_KEYS:
            draft.apiKeys = action.data;
            break;
        case ApiKeyActionTypes.CREATE_API_KEY: {
            // Strip the raw key before storing — it should only be shown once in the UI
            const storedData = { ...action.data };
            delete storedData.key;
            draft.apiKeys.unshift(storedData);
            break;
        }
        case ApiKeyActionTypes.REVOKE_API_KEY:
            if (action.data?.id) {
                const index = draft.apiKeys.findIndex((k) => k.id === action.data.id);
                if (index !== -1) {
                    draft.apiKeys[index] = { ...draft.apiKeys[index], ...action.data };
                }
            }
            break;
        case SocketClientActionTypes.LOGOUT:
            draft.apiKeys = [];
            break;
        default:
            break;
    }
}, initialState);

export default apiKeys;
