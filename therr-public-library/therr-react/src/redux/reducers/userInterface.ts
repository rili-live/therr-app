import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IUserInterfaceState, UserInterfaceActionTypes } from '../../types/redux/userInterface';

const initialState: IUserInterfaceState = Immutable.from({
    details: Immutable.from({
        lastClickedTargetId: '',
    }),
});

const userInterface = (state: IUserInterfaceState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    // TODO: consider storing as Set to prevent duplicates
    switch (action.type) {
        case UserInterfaceActionTypes.UPDATE_CLICK_TARGET:
            // Add latest moments to start
            return state.setIn(['details'], { ...state.details, lastClickedTargetId: action.data });
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['details'], Immutable.from(initialState.details));
        default:
            return state;
    }
};

export default userInterface;
