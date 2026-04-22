import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import reducer from '../userConnections';
import { UserConnectionActionTypes } from '../../../types/redux/userConnections';

describe('userConnections reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(Array.from(initialState.activeConnections)).toEqual([]);
        expect(Array.from(initialState.connections)).toEqual([]);
    });

    it('handles GET_USER_CONNECTIONS', () => {
        const result = reducer(initialState, {
            type: UserConnectionActionTypes.GET_USER_CONNECTIONS,
            data: [
                { id: 'u1', userName: 'user1' },
                { id: 'u2', userName: 'user2' },
            ],
        });
        expect(result.connections.length).toBe(2);
    });

    it('handles GET_USER_CONNECTIONS merges with existing (dedup by id)', () => {
        const first = reducer(initialState, {
            type: UserConnectionActionTypes.GET_USER_CONNECTIONS,
            data: [{ id: 'u1', userName: 'original' }],
        });
        const result = reducer(first, {
            type: UserConnectionActionTypes.GET_USER_CONNECTIONS,
            data: [{ id: 'u1', userName: 'updated' }, { id: 'u2', userName: 'new' }],
        });
        // u1 should be updated, u2 added
        expect(result.connections.length).toBe(2);
        const u1 = result.connections.find((c: any) => c.id === 'u1');
        expect(u1.userName).toBe('updated');
    });

    it('handles USER_CONNECTION_CREATED', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.USER_CONNECTION_CREATED,
            data: { id: 'u1', userName: 'new' },
        });
        expect(result.connections.length).toBe(1);
        expect(result.connections[0].id).toBe('u1');
    });

    it('handles USER_CONNECTION_UPDATED', () => {
        const populated = reducer(initialState, {
            type: UserConnectionActionTypes.GET_USER_CONNECTIONS,
            data: [{ id: 'u1' }],
        });
        const result = reducer(populated, {
            type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
            data: { id: 'u2', userName: 'updated' },
        });
        expect(result.connections.length).toBe(2);
    });

    it('handles ACTIVE_CONNECTIONS_ADDED by prepending', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_ADDED,
            data: { id: 'u1', status: 'active' },
        });
        expect(result.activeConnections.length).toBe(1);
        expect(result.activeConnections[0].id).toBe('u1');
    });

    it('handles ACTIVE_CONNECTIONS_LOADED', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED,
            data: { activeUsers: [{ id: 'u1' }, { id: 'u2' }] },
        });
        expect(result.activeConnections.length).toBe(2);
    });

    it('handles ACTIVE_CONNECTION_DISCONNECTED', () => {
        const populated = reducer(initialState, {
            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED,
            data: { activeUsers: [{ id: 'u1', status: 'active' }] },
        });
        const result = reducer(populated, {
            type: SocketServerActionTypes.ACTIVE_CONNECTION_DISCONNECTED,
            data: { id: 'u1' },
        });
        expect(result.activeConnections[0].status).toBe('away');
    });

    it('handles ACTIVE_CONNECTION_LOGGED_OUT by removing', () => {
        const populated = reducer(initialState, {
            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED,
            data: { activeUsers: [{ id: 'u1' }, { id: 'u2' }] },
        });
        const result = reducer(populated, {
            type: SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_OUT,
            data: { id: 'u1' },
        });
        expect(result.activeConnections.length).toBe(1);
        expect(result.activeConnections[0].id).toBe('u2');
    });

    it('handles ACTIVE_CONNECTION_LOGGED_IN for new user', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_IN,
            data: { id: 'u1', userName: 'user1' },
        });
        expect(result.activeConnections.length).toBe(1);
        expect(result.activeConnections[0].id).toBe('u1');
    });

    it('handles ACTIVE_CONNECTION_LOGGED_IN for existing user (updates)', () => {
        const populated = reducer(initialState, {
            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED,
            data: { activeUsers: [{ id: 'u1', status: 'away' }] },
        });
        const result = reducer(populated, {
            type: SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_IN,
            data: { id: 'u1' },
        });
        expect(result.activeConnections.length).toBe(1);
        expect(result.activeConnections[0].status).toBe('active');
    });

    it('handles SESSION_CLOSED by clearing', () => {
        const populated = reducer(initialState, {
            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED,
            data: { activeUsers: [{ id: 'u1' }] },
        });
        const result = reducer(populated, {
            type: SocketServerActionTypes.SESSION_CLOSED,
        });
        expect(Array.from(result.connections)).toEqual([]);
        expect(Array.from(result.activeConnections)).toEqual([]);
    });

    it('handles LOGOUT by clearing', () => {
        const populated = reducer(initialState, {
            type: UserConnectionActionTypes.GET_USER_CONNECTIONS,
            data: [{ id: 'u1' }],
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(Array.from(result.connections)).toEqual([]);
        expect(Array.from(result.activeConnections)).toEqual([]);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
