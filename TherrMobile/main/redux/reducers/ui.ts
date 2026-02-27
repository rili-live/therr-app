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
        default:
            break;
    }
}, initialState);

export default locations;
