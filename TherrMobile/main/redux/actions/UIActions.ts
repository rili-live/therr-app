import { IPrefetchState, ISoftOptInPushRequest, UIActionTypes } from '../../types/redux/ui';

const UI = {
    beginPrefetchRequest: (data: IPrefetchState = {}) => (dispatch: any) => {
        dispatch({
            type: UIActionTypes.PREFETCH_LOADING,
            data,
        });
        return Promise.resolve();
    },
    completePrefetchRequest: (data: IPrefetchState = {}) => (dispatch: any) => {
        dispatch({
            type: UIActionTypes.PREFETCH_COMPLETE,
            data,
        });
        return Promise.resolve();
    },
    requestSoftOptInPush: (data: ISoftOptInPushRequest = {}) => (dispatch: any) => {
        dispatch({
            type: UIActionTypes.REQUEST_SOFT_OPT_IN_PUSH,
            data,
        });
        return Promise.resolve();
    },
    clearSoftOptInPush: () => (dispatch: any) => {
        dispatch({
            type: UIActionTypes.CLEAR_SOFT_OPT_IN_PUSH,
        });
        return Promise.resolve();
    },
};

export default UI;
