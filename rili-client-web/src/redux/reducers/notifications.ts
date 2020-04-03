import * as Immutable from 'seamless-immutable';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
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
        case SocketServerActionTypes.NOTIFICATION_UPDATED:
            const modifiedMessages = state.messages.map((message) => { // eslint-disable-line no-case-declarations
                if (message.id === action.data.id) {
                    return {
                        ...message,
                        isUnread: action.data.isUnread,
                    };
                }

                return message;
            });
            return state.setIn(['messages'], modifiedMessages);
        default:
            return state;
    }
};

export default notifications;
