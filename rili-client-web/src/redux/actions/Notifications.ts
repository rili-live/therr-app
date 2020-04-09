import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import { NotificationActionTypes } from 'types/notifications';
import NotificationsService from '../../services/NotificationsService';

const Notification = {
    search: (query: any) => (dispatch: any) => NotificationsService.search(query).then((response) => {
        dispatch({
            type: NotificationActionTypes.GET_NOTIFICATIONS,
            data: response.data.results,
        });
    }),
    update: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.UPDATE_NOTIFICATION,
            data,
        });
    },
};

export default Notification;
