import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import reducer from '../notifications';
import { NotificationActionTypes } from '../../../types/redux/notifications';

describe('notifications reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(Array.from(initialState.messages)).toEqual([]);
    });

    it('handles GET_NOTIFICATIONS', () => {
        const notifications = [
            { id: 1, message: 'test1', isUnread: true },
            { id: 2, message: 'test2', isUnread: false },
        ];
        const result = reducer(initialState, {
            type: NotificationActionTypes.GET_NOTIFICATIONS,
            data: notifications,
        });
        expect(result.messages.length).toBe(2);
        expect(result.messages[0].id).toBe(1);
        expect(result.messages[1].id).toBe(2);
    });

    it('handles ADD_NOTIFICATION by prepending', () => {
        const populated = reducer(initialState, {
            type: NotificationActionTypes.GET_NOTIFICATIONS,
            data: [{ id: 1, message: 'existing' }],
        });
        const result = reducer(populated, {
            type: NotificationActionTypes.ADD_NOTIFICATION,
            data: { id: 2, message: 'new' },
        });
        expect(result.messages.length).toBe(2);
        expect(result.messages[0].id).toBe(2);
        expect(result.messages[1].id).toBe(1);
    });

    it('handles NOTIFICATION_CREATED by prepending', () => {
        const populated = reducer(initialState, {
            type: NotificationActionTypes.GET_NOTIFICATIONS,
            data: [{ id: 1, message: 'existing' }],
        });
        const result = reducer(populated, {
            type: SocketServerActionTypes.NOTIFICATION_CREATED,
            data: { id: 2, message: 'socket notification' },
        });
        expect(result.messages.length).toBe(2);
        expect(result.messages[0].id).toBe(2);
    });

    it('handles NOTIFICATION_UPDATED by merging matching notification', () => {
        const populated = reducer(initialState, {
            type: NotificationActionTypes.GET_NOTIFICATIONS,
            data: [
                { id: 1, message: 'original', isUnread: true },
                { id: 2, message: 'other' },
            ],
        });
        const result = reducer(populated, {
            type: SocketServerActionTypes.NOTIFICATION_UPDATED,
            data: { id: 1, isUnread: false },
        });
        expect(result.messages[0].message).toBe('original');
        expect(result.messages[0].isUnread).toBe(false);
        expect(result.messages[1].id).toBe(2);
    });

    it('handles LOGOUT by clearing messages', () => {
        const populated = reducer(initialState, {
            type: NotificationActionTypes.GET_NOTIFICATIONS,
            data: [{ id: 1, message: 'test' }],
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(Array.from(result.messages)).toEqual([]);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
