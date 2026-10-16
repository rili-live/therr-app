import axios from 'axios';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

/**
 * Push open tracking.
 *
 * A push sent through the users-service notification queue carries `notificationQueueId` in
 * its data map. Reporting it back on tap stamps `main.notificationQueue.openedAt`, which is
 * what turns "how many did we send" into "how many were opened, by type and by local hour"
 * — the evidence the daily cap and the reminder times are meant to be tuned against
 * (docs/NOTIFICATION_QUEUE_DESIGN.md → "Open tracking").
 *
 * Every tap is also logged to Firebase Analytics as `push_open`, queued or not, so inline
 * sends (which have no queue row) are at least countable by type.
 *
 * One tap can arrive through more than one listener — Notifee's press event, Firebase's
 * onNotificationOpenedApp / getInitialNotification on iOS, and the initial-notification read
 * repeated on a Layout remount — so each push is reported once per app session. The server
 * keeps the first open regardless; this only saves the duplicate requests and events.
 */

const MAX_REMEMBERED = 100;
const reported: string[] = [];

const toStringValue = (value: unknown): string => (typeof value === 'string' ? value : '');

const getOpenKey = (data: Record<string, unknown>): string => {
    const queueId = toStringValue(data.notificationQueueId);
    if (queueId) {
        return queueId;
    }
    // Inline sends have no id; `type` + the send `timestamp` push-notifications-service
    // stamps on every message identifies one push well enough to dedupe listeners.
    const type = toStringValue(data.type);
    const timestamp = toStringValue(data.timestamp);
    return type && timestamp ? `${type}:${timestamp}` : '';
};

export const reportPushOpen = (
    data: Record<string, unknown> | undefined,
    pressActionId: string | undefined,
): void => {
    if (!data || typeof data !== 'object') {
        return;
    }

    const key = getOpenKey(data);
    if (!key || reported.includes(key)) {
        return;
    }
    reported.push(key);
    if (reported.length > MAX_REMEMBERED) {
        reported.shift();
    }

    const notificationQueueId = toStringValue(data.notificationQueueId);
    const action = pressActionId || 'default';

    logEvent(getAnalytics(), 'push_open', {
        notification_type: toStringValue(data.type).slice(0, 100),
        press_action: action.slice(0, 100),
        is_queued: notificationQueueId ? 'true' : 'false',
    }).catch((err) => console.log(err));

    if (!notificationQueueId) {
        return;
    }

    // Fire-and-forget: never delay or fail the navigation the tap was for. A logged-out
    // user's tap 401s here, which is correct — there is no session to attribute it to.
    axios({
        method: 'post',
        url: '/users-service/users/notifications/push-opens',
        data: {
            notificationQueueId,
            pressActionId: action,
        },
    }).catch((err) => console.log('PUSH_OPEN_REPORT_ERROR', err?.message));
};

// Test-only: the dedupe list is module state that outlives a single test.
export const resetPushOpenTrackingForTests = (): void => {
    reported.length = 0;
};
