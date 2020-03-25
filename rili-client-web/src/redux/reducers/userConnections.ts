import * as Immutable from 'seamless-immutable';
import { IUserConnectionsState, UserConnectionActionTypes } from 'types/userConnections';

const initialState: IUserConnectionsState = Immutable.from({
    connections: Immutable.from([]),
});

const userConnections = (state: IUserConnectionsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    switch (action.type) {
        // TODO: Rethink this
        case UserConnectionActionTypes.GET_USER_CONNECTIONS:
            return state.setIn(['connections'], action.data);
        default:
            return state;
    }
};

export default userConnections;
