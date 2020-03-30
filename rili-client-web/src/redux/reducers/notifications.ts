import * as Immutable from 'seamless-immutable';
import { INotificationsState, NotificationActionTypes } from 'types/notifications';

const initialState: INotificationsState = Immutable.from({
    messages: Immutable.from([]),
});

const notifications = (state: INotificationsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    switch (action.type) {
        // TODO: Rethink this
        case NotificationActionTypes.GET_NOTIFICATIONS:
            return state.setIn(['messages'], action.data);
        default:
            return state;
    }
};

export default notifications;
