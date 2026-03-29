import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import reducer from '../forums';
import { ForumActionTypes } from '../../../types/redux/forums';

describe('forums reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(Array.from(initialState.activeForums)).toEqual([]);
        expect(Array.from(initialState.forumCategories)).toEqual([]);
        expect(Array.from(initialState.searchResults)).toEqual([]);
    });

    it('handles CREATE_FORUM by prepending to search results', () => {
        const populated = reducer(initialState, {
            type: ForumActionTypes.SEARCH_FORUMS,
            data: {
                results: [{ id: 'f1', name: 'Existing' }],
                pagination: { page: 1 },
            },
        });
        const result = reducer(populated, {
            type: ForumActionTypes.CREATE_FORUM,
            data: { id: 'f2', name: 'New Forum' },
        });
        expect(result.searchResults.length).toBe(2);
        expect(result.searchResults[0].name).toBe('New Forum');
        expect(result.searchResults[1].name).toBe('Existing');
    });

    it('handles CREATE_FORUM with forum property', () => {
        const result = reducer(initialState, {
            type: ForumActionTypes.CREATE_FORUM,
            data: { forum: { id: 'f1', name: 'Forum via .forum' } },
        });
        expect(result.searchResults[0].name).toBe('Forum via .forum');
    });

    it('handles UPDATE_FORUM by merging', () => {
        const populated = reducer(initialState, {
            type: ForumActionTypes.SEARCH_FORUMS,
            data: {
                results: [{ id: 'f1', name: 'Original', description: 'desc' }],
                pagination: {},
            },
        });
        const result = reducer(populated, {
            type: ForumActionTypes.UPDATE_FORUM,
            data: { id: 'f1', name: 'Updated' },
        });
        expect(result.searchResults[0].name).toBe('Updated');
        expect(result.searchResults[0].description).toBe('desc');
    });

    it('handles DELETE_FORUM by removing from search results', () => {
        const populated = reducer(initialState, {
            type: ForumActionTypes.SEARCH_FORUMS,
            data: {
                results: [
                    { id: 'f1', name: 'Forum 1' },
                    { id: 'f2', name: 'Forum 2' },
                ],
                pagination: {},
            },
        });
        const result = reducer(populated, {
            type: ForumActionTypes.DELETE_FORUM,
            data: { id: 'f1' },
        });
        expect(result.searchResults.length).toBe(1);
        expect(result.searchResults[0].id).toBe('f2');
    });

    it('handles SEARCH_FORUMS', () => {
        const result = reducer(initialState, {
            type: ForumActionTypes.SEARCH_FORUMS,
            data: {
                results: [{ id: 'f1' }, { id: 'f2' }],
                pagination: { page: 1, total: 2 },
            },
        });
        expect(result.searchResults.length).toBe(2);
        expect(result.pagination.page).toBe(1);
    });

    it('handles SEARCH_FORUM_CATEGORIES', () => {
        const result = reducer(initialState, {
            type: ForumActionTypes.SEARCH_FORUM_CATEGORIES,
            data: { results: ['cat1', 'cat2'] },
        });
        expect(result.forumCategories.length).toBe(2);
    });

    it('handles SEND_ROOMS_LIST', () => {
        const result = reducer(initialState, {
            type: SocketServerActionTypes.SEND_ROOMS_LIST,
            data: [{ id: 'room1' }, { id: 'room2' }],
        });
        expect(result.activeForums.length).toBe(2);
    });

    it('handles LOGOUT by clearing results', () => {
        const populated = reducer(initialState, {
            type: ForumActionTypes.SEARCH_FORUMS,
            data: {
                results: [{ id: 'f1' }],
                pagination: { page: 1 },
            },
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(Array.from(result.searchResults)).toEqual([]);
        expect(Array.from(result.myForumsSearchResults)).toEqual([]);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
