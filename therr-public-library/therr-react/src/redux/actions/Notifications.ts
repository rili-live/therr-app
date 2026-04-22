import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { NotificationActionTypes } from '../../types/redux/notifications';
import NotificationsService from '../../services/NotificationsService';
import { isOfflineError } from '../../utilities/cacheHelpers';

const Notification = {
    search: (query: any) => (dispatch: any) => NotificationsService.search(query).then((response: any) => {
        if (response?.isOfflineFallback) return;
        dispatch({
            type: NotificationActionTypes.GET_NOTIFICATIONS,
            data: response.data.results,
        });
    }).catch((err) => { if (!isOfflineError(err)) { throw err; } }),
    add: (data: any) => (dispatch: any) => {
        dispatch({
            type: NotificationActionTypes.ADD_NOTIFICATION,
            data,
        });
    },
    update: (data: any) => (dispatch: any) => {
        // Optimistic UI update
        dispatch({
            type: NotificationActionTypes.NOTIFICATION_UPDATED,
            data: data.notification,
        });

        // Dispatch via socket (works when connected, silently dropped otherwise)
        dispatch({
            type: SocketClientActionTypes.UPDATE_NOTIFICATION,
            data,
        });

        // Also send REST request as reliable backup
        return NotificationsService.update(data.notification.id, {
            isUnread: data.notification.isUnread,
            userConnection: data.notification.userConnection,
        }).catch(() => {
            // REST failed; socket may have succeeded
        });
    },
    markAllRead: (notifications: any[]) => (dispatch: any) => {
        const unreadNotifications = notifications.filter((n) => n.isUnread);
        const batchSize = 10;

        // Optimistic UI update for all at once
        unreadNotifications.forEach((notification) => {
            dispatch({
                type: NotificationActionTypes.NOTIFICATION_UPDATED,
                data: { ...notification, isUnread: false },
            });
        });

        // Send REST requests in batches to avoid overwhelming the server
        const processBatch = (startIdx: number) => {
            const batch = unreadNotifications.slice(startIdx, startIdx + batchSize);
            if (batch.length === 0) {
                return Promise.resolve();
            }

            return Promise.allSettled(
                batch.map((notification) => NotificationsService.update(notification.id, { isUnread: false })),
            ).then(() => processBatch(startIdx + batchSize));
        };

        return processBatch(0);
    },
};

export default Notification;
