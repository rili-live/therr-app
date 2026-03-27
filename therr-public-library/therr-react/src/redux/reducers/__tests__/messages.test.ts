import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import reducer from '../messages';
import { MessageActionTypes } from '../../../types/redux/messages';

describe('messages reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(Array.from(initialState.forums)).toEqual([]);
        expect(initialState.dms).toBeDefined();
        expect(initialState.forumMsgs).toBeDefined();
    });

    // Forum Messages
    it('handles JOINED_ROOM with message', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.JOINED_ROOM,
            data: {
                roomId: 'room1',
                message: { key: 'msg1', text: 'Hello' },
            },
        });
        expect(result.forumMsgs.room1.length).toBe(1);
        expect(result.forumMsgs.room1[0].text).toBe('Hello');
    });

    it('handles SEND_MESSAGE by prepending to room', () => {
        const withRoom = reducer(initialState, {
            type: SocketServerActionTypes.JOINED_ROOM,
            data: {
                roomId: 'room1',
                message: { key: 'msg1', text: 'First' },
            },
        });
        const result = reducer(withRoom, {
            type: SocketServerActionTypes.SEND_MESSAGE,
            data: {
                roomId: 'room1',
                message: { key: 'msg2', text: 'Second' },
            },
        });
        expect(result.forumMsgs.room1.length).toBe(2);
        expect(result.forumMsgs.room1[0].text).toBe('Second');
    });

    it('handles GET_FORUM_MESSAGES', () => {
        const result = reducer(initialState, {
            type: MessageActionTypes.GET_FORUM_MESSAGES,
            data: {
                roomId: 'room1',
                messages: [{ key: 'msg1' }, { key: 'msg2' }],
            },
        });
        expect(result.forumMsgs.room1.length).toBe(2);
    });

    // DMs
    it('handles GET_DIRECT_MESSAGES', () => {
        const result = reducer(initialState, {
            type: MessageActionTypes.GET_DIRECT_MESSAGES,
            data: {
                contextUserId: 'user1',
                messages: [{ key: 'dm1' }, { key: 'dm2' }],
                isLastPage: false,
            },
        });
        expect(result.dms.user1.length).toBe(2);
    });

    it('handles GET_DIRECT_MESSAGES marks last message on last page', () => {
        const result = reducer(initialState, {
            type: MessageActionTypes.GET_DIRECT_MESSAGES,
            data: {
                contextUserId: 'user1',
                messages: [{ key: 'dm1' }, { key: 'dm2' }],
                isLastPage: true,
            },
        });
        expect(result.dms.user1[1].isFirstMessage).toBe(true);
    });

    it('handles GET_MORE_DIRECT_MESSAGES appending', () => {
        const initial = reducer(initialState, {
            type: MessageActionTypes.GET_DIRECT_MESSAGES,
            data: {
                contextUserId: 'user1',
                messages: [{ key: 'dm1' }],
                isLastPage: false,
            },
        });
        const result = reducer(initial, {
            type: MessageActionTypes.GET_MORE_DIRECT_MESSAGES,
            data: {
                contextUserId: 'user1',
                messages: [{ key: 'dm2' }],
                isLastPage: false,
            },
        });
        expect(result.dms.user1.length).toBe(2);
    });

    it('handles GET_MY_DIRECT_MESSAGES', () => {
        const result = reducer(initialState, {
            type: MessageActionTypes.GET_MY_DIRECT_MESSAGES,
            data: {
                results: [{ id: 'conv1' }],
                pagination: { page: 1 },
            },
        });
        expect(result.myDMs.length).toBe(1);
        expect(result.myDMsPagination.page).toBe(1);
    });

    it('handles GET_MORE_OF_MY_DIRECT_MESSAGES appending', () => {
        const initial = reducer(initialState, {
            type: MessageActionTypes.GET_MY_DIRECT_MESSAGES,
            data: {
                results: [{ id: 'conv1' }],
                pagination: { page: 1 },
            },
        });
        const result = reducer(initial, {
            type: MessageActionTypes.GET_MORE_OF_MY_DIRECT_MESSAGES,
            data: {
                results: [{ id: 'conv2' }],
                pagination: { page: 2 },
            },
        });
        expect(result.myDMs.length).toBe(2);
        expect(result.myDMsPagination.page).toBe(2);
    });

    it('handles SEND_DIRECT_MESSAGE by prepending', () => {
        const initial = reducer(initialState, {
            type: MessageActionTypes.GET_DIRECT_MESSAGES,
            data: {
                contextUserId: 'user1',
                messages: [{ key: 'dm1' }],
                isLastPage: false,
            },
        });
        const result = reducer(initial, {
            type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
            data: {
                contextUserId: 'user1',
                message: { key: 'dm2', text: 'New message' },
            },
        });
        expect(result.dms.user1.length).toBe(2);
        expect(result.dms.user1[0].text).toBe('New message');
    });

    it('handles LOGOUT by clearing', () => {
        const populated = reducer(initialState, {
            type: MessageActionTypes.GET_FORUM_MESSAGES,
            data: {
                roomId: 'room1',
                messages: [{ key: 'msg1' }],
            },
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(result.forums).toEqual([]);
        expect(result.dms).toEqual([]);
        expect(result.forumMsgs).toEqual([]);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
