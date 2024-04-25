import Immutable from 'seamless-immutable';
import { IUIState, UIActionTypes } from '../../types/redux/ui';

const initialState: IUIState = Immutable.from({
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
});

const locations = (state: IUIState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState;
    }

    switch (action.type) {
        case UIActionTypes.PREFETCH_LOADING:
            return state.setIn(
                ['prefetch'],
                {
                    ...state.prefetch,
                    ...action.data,
                }
            );
        case UIActionTypes.PREFETCH_COMPLETE:
            return state.setIn(
                ['prefetch'],
                {
                    ...state.prefetch,
                    ...action.data,
                }
            );
        default:
            return state;
    }
};

export default locations;
