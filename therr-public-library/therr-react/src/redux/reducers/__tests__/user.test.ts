import getUserReducer from '../user';
import { UserActionTypes } from '../../../types/redux/user';
import { ForumActionTypes } from '../../../types';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';

describe('user reducer', () => {
    let initialState: any;
    let reducer: any;
    const mockSocketIO = { disconnect: jest.fn() };

    beforeEach(() => {
        mockSocketIO.disconnect.mockClear();
        reducer = getUserReducer(mockSocketIO);
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(initialState.details).toBeNull();
        expect(initialState.isAuthenticated).toBe(false);
        expect(initialState.settings.locale).toBe('en-us');
        expect(initialState.socketDetails).toBeDefined();
    });

    // Auth
    it('handles LOGIN', () => {
        const userData = { id: 'u1', userName: 'test', email: 'test@test.com' };
        const result = reducer(initialState, {
            type: UserActionTypes.LOGIN,
            data: userData,
        });
        expect(result.details.id).toBe('u1');
        expect(result.isAuthenticated).toBe(true);
    });

    // Users
    it('handles GET_USERS', () => {
        const result = reducer(initialState, {
            type: UserActionTypes.GET_USERS,
            data: {
                results: [
                    { id: 'u1', userName: 'user1' },
                    { id: 'u2', userName: 'user2' },
                ],
                mightKnowResults: [{ id: 'u3' }],
            },
        });
        expect(result.users['u1'].userName).toBe('user1');
        expect(result.users['u2'].userName).toBe('user2');
        expect(result.usersMightKnow['u3']).toBeDefined();
    });

    it('handles GET_USERS_REFETCH (clears stale results)', () => {
        const populated = reducer(initialState, {
            type: UserActionTypes.GET_USERS,
            data: { results: [{ id: 'u1' }] },
        });
        const result = reducer(populated, {
            type: UserActionTypes.GET_USERS_REFETCH,
            data: { results: [{ id: 'u2' }] },
        });
        expect(result.users['u1']).toBeUndefined();
        expect(result.users['u2']).toBeDefined();
    });

    it('handles GET_USERS_UPDATE', () => {
        const populated = reducer(initialState, {
            type: UserActionTypes.GET_USERS,
            data: { results: [{ id: 'u1', userName: 'old' }] },
        });
        const result = reducer(populated, {
            type: UserActionTypes.GET_USERS_UPDATE,
            data: { id: 'u1', updates: { userName: 'new' } },
        });
        expect(result.users['u1'].userName).toBe('new');
    });

    it('handles GET_USERS_PAIRINGS', () => {
        const result = reducer(initialState, {
            type: UserActionTypes.GET_USERS_PAIRINGS,
            data: {
                results: [{ id: 'p1', name: 'Pairing 1' }],
            },
        });
        expect(result.influencerPairings['p1'].name).toBe('Pairing 1');
    });

    // Achievements
    it('handles GET_MY_ACHIEVEMENTS', () => {
        const result = reducer(initialState, {
            type: UserActionTypes.GET_MY_ACHIEVEMENTS,
            data: { ach1: { id: 'ach1', name: 'First Login' } },
        });
        expect(result.achievements.ach1.name).toBe('First Login');
    });

    it('handles UPDATE_MY_ACHIEVEMENTS', () => {
        const populated = reducer(initialState, {
            type: UserActionTypes.GET_MY_ACHIEVEMENTS,
            data: { ach1: { id: 'ach1', progress: 50 } },
        });
        const result = reducer(populated, {
            type: UserActionTypes.UPDATE_MY_ACHIEVEMENTS,
            data: { id: 'ach1', progress: 100 },
        });
        expect(result.achievements.ach1.progress).toBe(100);
    });

    // Socket
    it('handles JOINED_ROOM', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.JOINED_ROOM,
            data: { roomId: 'room1' },
        });
        expect(result.socketDetails.currentRoom).toBe('room1');
    });

    it('handles SESSION_CREATED', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.SESSION_CREATED,
            data: { data: { id: 'session1' } },
        });
        expect(result.socketDetails.session.id).toBe('session1');
    });

    it('handles SESSION_CLOSED (disconnects socket)', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.SESSION_CLOSED,
        });
        expect(mockSocketIO.disconnect).toHaveBeenCalled();
        expect(result.socketDetails.session).toEqual({});
    });

    // User updates
    it('handles UPDATE_USER (merges details and settings)', () => {
        const loggedIn = reducer(initialState, {
            type: UserActionTypes.LOGIN,
            data: { id: 'u1', userName: 'test' },
        });
        const result = reducer(loggedIn, {
            type: SocketClientActionTypes.UPDATE_USER,
            data: {
                details: { firstName: 'John' },
                settings: { locale: 'es' },
            },
        });
        expect(result.details.id).toBe('u1');
        expect(result.details.firstName).toBe('John');
        expect(result.settings.locale).toBe('es');
        expect(result.settings.mobileThemeName).toBe('light'); // preserved
    });

    it('handles RESET_USER_SETTINGS', () => {
        const result = reducer(initialState, {
            type: SocketClientActionTypes.RESET_USER_SETTINGS,
            data: { settings: { locale: 'fr', mobileThemeName: 'dark' } },
        });
        expect(result.settings.locale).toBe('fr');
    });

    it('handles UPDATE_USER_TOUR', () => {
        const result = reducer(initialState, {
            type: UserActionTypes.UPDATE_USER_TOUR,
            data: { isTouring: true },
        });
        expect(result.settings.isTouring).toBe(true);
        expect(result.settings.locale).toBe('en-us'); // preserved
    });

    it('handles GET_USER', () => {
        const result = reducer(initialState, {
            type: UserActionTypes.GET_USER,
            data: { id: 'u1', userName: 'viewedUser' },
        });
        expect(result.userInView.userName).toBe('viewedUser');
    });

    it('handles UPDATE_USER_IN_VIEW', () => {
        const withUser = reducer(initialState, {
            type: UserActionTypes.GET_USER,
            data: { id: 'u1', userName: 'original' },
        });
        const result = reducer(withUser, {
            type: UserActionTypes.UPDATE_USER_IN_VIEW,
            data: { bio: 'Updated bio' },
        });
        expect(result.userInView.userName).toBe('original');
        expect(result.userInView.bio).toBe('Updated bio');
    });

    // Thoughts
    it('handles GET_THOUGHTS', () => {
        const result = reducer(initialState, {
            type: UserActionTypes.GET_THOUGHTS,
            data: { results: [{ id: 't1' }] },
        });
        expect(result.thoughts.length).toBe(1);
    });

    it('handles THOUGHT_CREATED prepends', () => {
        const populated = reducer(initialState, {
            type: UserActionTypes.GET_MY_THOUGHTS,
            data: { results: [{ id: 't1' }] },
        });
        const result = reducer(populated, {
            type: UserActionTypes.THOUGHT_CREATED,
            data: { id: 't2', text: 'new' },
        });
        expect(result.myThoughts.length).toBe(2);
        expect(result.myThoughts[0].id).toBe('t2');
    });

    it('handles THOUGHT_DELETED', () => {
        const populated = reducer(initialState, {
            type: UserActionTypes.GET_MY_THOUGHTS,
            data: { results: [{ id: 't1' }, { id: 't2' }] },
        });
        const result = reducer(populated, {
            type: UserActionTypes.THOUGHT_DELETED,
            data: { ids: ['t1'] },
        });
        expect(result.myThoughts.length).toBe(1);
        expect(result.myThoughts[0].id).toBe('t2');
    });

    // User Groups
    it('handles GET_USER_GROUPS', () => {
        const result = reducer(initialState, {
            type: UserActionTypes.GET_USER_GROUPS,
            data: { userGroups: [{ groupId: 'g1', name: 'Group 1' }] },
        });
        expect(result.myUserGroups['g1'].name).toBe('Group 1');
    });

    it('handles USER_GROUP_CREATED', () => {
        const result = reducer(initialState, {
            type: UserActionTypes.USER_GROUP_CREATED,
            data: { groupId: 'g1', name: 'New Group' },
        });
        expect(result.myUserGroups['g1'].name).toBe('New Group');
    });

    it('handles USER_GROUP_DELETED', () => {
        const populated = reducer(initialState, {
            type: UserActionTypes.USER_GROUP_CREATED,
            data: { groupId: 'g1' },
        });
        const result = reducer(populated, {
            type: UserActionTypes.USER_GROUP_DELETED,
            data: { groupId: 'g1' },
        });
        expect(result.myUserGroups['g1']).toBeUndefined();
    });

    // Logout
    it('handles LOGOUT', () => {
        const loggedIn = reducer(initialState, {
            type: UserActionTypes.LOGIN,
            data: { id: 'u1', userName: 'test', media: { avatar: 'url' } },
        });
        const result = reducer(loggedIn, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(result.isAuthenticated).toBe(false);
        expect(Object.keys(result.socketDetails)).toHaveLength(0);
        expect(Object.keys(result.users)).toHaveLength(0);
        // Should retain id, userName, media
        expect(result.details.id).toBe('u1');
        expect(result.details.userName).toBe('test');
        expect(result.details.media.avatar).toBe('url');
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
