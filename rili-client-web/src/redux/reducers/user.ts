import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import { IUserState } from 'types/user';

const initialState: IUserState = Immutable.from({
    details: null,
    isAuthenticated: null,
});

const user = (state: IUserState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    switch (action.type) {
        case SocketClientActionTypes.LOGIN:
            return state.setIn(['isAuthenticated'], true).setIn(['details'], action.data);
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['isAuthenticated'], null).setIn(['details'], null);
        default:
            return state;
    }
};

export default user;
