import { produce } from 'immer';
import { SocketServerActionTypes, SocketClientActionTypes } from 'therr-js-utilities/constants';
import { INotificationsState, NotificationActionTypes } from '../../types/redux/notifications';

const initialState: INotificationsState = {
    messages: [],
};

const notifications = produce((draft: INotificationsState, action: any) => {
    switch (action.type) {
        case NotificationActionTypes.GET_NOTIFICATIONS:
            draft.messages = action.data;
            break;
        case NotificationActionTypes.ADD_NOTIFICATION:
        case SocketServerActionTypes.NOTIFICATION_CREATED:
            draft.messages.unshift(action.data);
            break;
        case SocketServerActionTypes.NOTIFICATION_UPDATED: {
            const idx = draft.messages.findIndex((message) => message.id === action.data.id);
            if (idx !== -1) {
                draft.messages[idx] = { ...draft.messages[idx], ...action.data };
            }
            break;
        }
        case SocketClientActionTypes.LOGOUT:
            draft.messages = [];
            break;
        default:
            break;
    }
}, initialState);

export default notifications;
