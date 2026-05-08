import { IPrefetchState, UIActionTypes } from '../../types/redux/ui';

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
};

export default UI;
