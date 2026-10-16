// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach } from '@jest/globals';
import axios from 'axios';
import { logEvent } from '@react-native-firebase/analytics';
import { reportPushOpen, resetPushOpenTrackingForTests } from '../../main/utilities/pushOpenTracking';

/**
 * Push open tracking — a tap on a queued push is reported back so the send's row records
 * `openedAt`. One tap reaches several listeners, so the report must happen once per push.
 */

jest.mock('axios', () => jest.fn(() => Promise.resolve({ status: 204 })));

jest.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

const QUEUE_ID = 'cccccccc-0000-4000-8000-000000000003';
const mockedAxios = axios as unknown as jest.Mock;
const mockedLogEvent = logEvent as unknown as jest.Mock;

describe('reportPushOpen', () => {
    beforeEach(() => {
        resetPushOpenTrackingForTests();
        mockedAxios.mockClear();
        mockedLogEvent.mockClear();
    });

    it('reports a queued push against its row, with the press action', () => {
        reportPushOpen({ type: 'streak-at-risk', notificationQueueId: QUEUE_ID }, 'habit-checkin');

        expect(mockedAxios).toHaveBeenCalledTimes(1);
        expect(mockedAxios.mock.calls[0][0]).toEqual({
            method: 'post',
            url: '/users-service/users/notifications/push-opens',
            data: { notificationQueueId: QUEUE_ID, pressActionId: 'habit-checkin' },
        });
        expect(mockedLogEvent).toHaveBeenCalledWith({}, 'push_open', {
            notification_type: 'streak-at-risk',
            press_action: 'habit-checkin',
            is_queued: 'true',
        });
    });

    it('reports the same push once however many listeners deliver the tap', () => {
        const data = { type: 'streak-at-risk', notificationQueueId: QUEUE_ID };

        reportPushOpen(data, 'default');
        reportPushOpen(data, 'default');
        reportPushOpen(data, undefined);

        expect(mockedAxios).toHaveBeenCalledTimes(1);
        expect(mockedLogEvent).toHaveBeenCalledTimes(1);
    });

    it('logs an inline push to analytics without calling the API', () => {
        reportPushOpen({ type: 'new-direct-message', timestamp: '1760000000000' }, undefined);

        expect(mockedAxios).not.toHaveBeenCalled();
        expect(mockedLogEvent).toHaveBeenCalledWith({}, 'push_open', {
            notification_type: 'new-direct-message',
            press_action: 'default',
            is_queued: 'false',
        });
    });

    it('ignores a press with nothing to identify the push', () => {
        reportPushOpen(undefined, 'default');
        reportPushOpen({}, 'default');

        expect(mockedAxios).not.toHaveBeenCalled();
        expect(mockedLogEvent).not.toHaveBeenCalled();
    });

    it('never throws when the report fails', async () => {
        mockedAxios.mockImplementationOnce(() => Promise.reject(new Error('offline')));

        expect(() => reportPushOpen({ type: 'streak-at-risk', notificationQueueId: QUEUE_ID }, 'default')).not.toThrow();
        await Promise.resolve();
    });
});
