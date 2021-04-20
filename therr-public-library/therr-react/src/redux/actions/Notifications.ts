import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { NotificationActionTypes } from '../../types/redux/notifications';
import NotificationsService from '../../services/NotificationsService';

const Notification = {
    search: (query: any) => (dispatch: any) => NotificationsService.search(query).then((response: any) => {
        dispatch({
            type: NotificationActionTypes.GET_NOTIFICATIONS,
            data: response.data.results,
        });
    }),
    add: (data: any) => (dispatch: any) => {
        dispatch({
            type: NotificationActionTypes.ADD_NOTIFICATION,
            data,
        });
    },
    update: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.UPDATE_NOTIFICATION,
            data,
        });
    },
};

export default Notification;
