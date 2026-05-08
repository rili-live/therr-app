import { produce } from 'immer';
import { IUIState, UIActionTypes } from '../../types/redux/ui';

const initialState: IUIState = {
    prefetch: {
        isLoadingActiveEvents: false,
        isLoadingActiveMoments: false,
        isLoadingActiveSpaces: false,
        isLoadingActiveThoughts: false,
        isLoadingAchievements: false,
        isLoadingUsers: false,
        isLoadingGroups: false,
        isLoadingNotifications: false,
    },
    pendingSoftOptInPush: null,
};

const locations = produce((draft: IUIState, action: any) => {
    switch (action.type) {
        case UIActionTypes.PREFETCH_LOADING:
            draft.prefetch = {
                ...draft.prefetch,
                ...action.data,
            };
            break;
        case UIActionTypes.PREFETCH_COMPLETE:
            draft.prefetch = {
                ...draft.prefetch,
                ...action.data,
            };
            break;
        case UIActionTypes.REQUEST_SOFT_OPT_IN_PUSH:
            draft.pendingSoftOptInPush = action.data || {};
            break;
        case UIActionTypes.CLEAR_SOFT_OPT_IN_PUSH:
            draft.pendingSoftOptInPush = null;
            break;
        default:
            break;
    }
}, initialState);

export default locations;
