import * as Immutable from 'seamless-immutable';
import { SocketServerActionTypes } from 'rili-js-utilities/constants';
import { INotificationsState, NotificationActionTypes } from '../../types/redux/notifications';

const initialState: INotificationsState = Immutable.from({
    messages: Immutable.from([]),
});

const notifications = (state: INotificationsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    let modifiedMessages = [...state.messages];

    switch (action.type) {
        // TODO: Rethink this
        case NotificationActionTypes.GET_NOTIFICATIONS:
            return state.setIn(['messages'], action.data);
        case SocketServerActionTypes.NOTIFICATION_CREATED:
            modifiedMessages.unshift(action.data);
            return state.setIn(['messages'], modifiedMessages);
        case SocketServerActionTypes.NOTIFICATION_UPDATED:
            modifiedMessages = state.messages.map((message) => { // eslint-disable-line no-case-declarations
                if (message.id === action.data.id) {
                    return {
                        ...message,
                        ...action.data,
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
