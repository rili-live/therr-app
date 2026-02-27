import reducer from '../content';
import { ContentActionTypes } from '../../../types/redux/content';
import { MapActionTypes } from '../../../types/redux/maps';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';

describe('content reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(Array.from(initialState.activeEvents)).toEqual([]);
        expect(Array.from(initialState.activeMoments)).toEqual([]);
        expect(Array.from(initialState.activeSpaces)).toEqual([]);
        expect(Array.from(initialState.activeThoughts)).toEqual([]);
        expect(Array.from(initialState.bookmarkedEvents)).toEqual([]);
        expect(Array.from(initialState.myDrafts)).toEqual([]);
        expect(initialState.activeAreasFilters.order).toBe('DESC');
    });

    // Events
    it('handles INSERT_ACTIVE_EVENTS', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1' }, { id: 'e2' }],
        });
        expect(result.activeEvents.length).toBe(2);
    });

    it('handles INSERT_ACTIVE_EVENTS prepends to existing', () => {
        const populated = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1' }],
        });
        const result = reducer(populated, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e2' }],
        });
        expect(result.activeEvents.length).toBe(2);
    });

    it('handles REMOVE_ACTIVE_EVENTS', () => {
        const populated = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1' }, { id: 'e2' }],
        });
        const result = reducer(populated, {
            type: ContentActionTypes.REMOVE_ACTIVE_EVENTS,
            data: { eventId: 'e1' },
        });
        expect(result.activeEvents.length).toBe(1);
        expect(result.activeEvents[0].id).toBe('e2');
    });

    it('handles UPDATE_ACTIVE_EVENT_REACTION', () => {
        const populated = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1' }],
        });
        const result = reducer(populated, {
            type: ContentActionTypes.UPDATE_ACTIVE_EVENT_REACTION,
            data: { eventId: 'e1', rating: 5 },
        });
        expect(result.activeEvents[0].reaction.rating).toBe(5);
    });

    it('handles SEARCH_ACTIVE_EVENTS with dedup', () => {
        const populated = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1', title: 'existing' }],
        });
        const result = reducer(populated, {
            type: ContentActionTypes.SEARCH_ACTIVE_EVENTS,
            data: {
                events: [{ id: 'e2', title: 'new' }, { id: 'e1', title: 'updated' }],
                pagination: { page: 1 },
            },
        });
        // Should have both events, with e2 first (new results first)
        expect(result.activeEvents.length).toBe(2);
        expect(result.activeEventsPagination.page).toBe(1);
    });

    it('handles UPDATE_ACTIVE_EVENTS (replaces from scratch)', () => {
        const populated = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1' }],
        });
        const result = reducer(populated, {
            type: ContentActionTypes.UPDATE_ACTIVE_EVENTS,
            data: {
                events: [{ id: 'e2' }],
                pagination: { page: 1 },
            },
        });
        expect(result.activeEvents.length).toBe(1);
        expect(result.activeEvents[0].id).toBe('e2');
    });

    it('handles SEARCH_BOOKMARKED_EVENTS', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.SEARCH_BOOKMARKED_EVENTS,
            data: {
                events: [{ id: 'e1' }],
                media: { m1: { url: 'test' } },
            },
        });
        expect(result.bookmarkedEvents.length).toBe(1);
        expect(result.media.m1.url).toBe('test');
    });

    // Moments
    it('handles INSERT_ACTIVE_MOMENTS', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_MOMENTS,
            data: [{ id: 'm1' }],
        });
        expect(result.activeMoments.length).toBe(1);
    });

    it('handles REMOVE_ACTIVE_MOMENTS', () => {
        const populated = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_MOMENTS,
            data: [{ id: 'm1' }, { id: 'm2' }],
        });
        const result = reducer(populated, {
            type: ContentActionTypes.REMOVE_ACTIVE_MOMENTS,
            data: { momentId: 'm1' },
        });
        expect(result.activeMoments.length).toBe(1);
    });

    it('handles UPDATE_ACTIVE_MOMENTS (replaces from scratch)', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.UPDATE_ACTIVE_MOMENTS,
            data: {
                moments: [{ id: 'm1' }],
                media: {},
                pagination: { page: 1 },
            },
        });
        expect(result.activeMoments.length).toBe(1);
    });

    // Spaces
    it('handles INSERT_ACTIVE_SPACES', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_SPACES,
            data: [{ id: 's1' }],
        });
        expect(result.activeSpaces.length).toBe(1);
    });

    it('handles UPDATE_ACTIVE_SPACES (replaces from scratch)', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.UPDATE_ACTIVE_SPACES,
            data: {
                spaces: [{ id: 's1' }],
                media: {},
                pagination: { page: 1 },
            },
        });
        expect(result.activeSpaces.length).toBe(1);
    });

    // Thoughts
    it('handles INSERT_ACTIVE_THOUGHTS', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_THOUGHTS,
            data: [{ id: 't1' }],
        });
        expect(result.activeThoughts.length).toBe(1);
    });

    it('handles UPDATE_ACTIVE_THOUGHTS (replaces from scratch)', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.UPDATE_ACTIVE_THOUGHTS,
            data: {
                thoughts: [{ id: 't1' }],
                pagination: { page: 1 },
            },
        });
        expect(result.activeThoughts.length).toBe(1);
    });

    // Drafts
    it('handles SEARCH_MY_DRAFTS', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.SEARCH_MY_DRAFTS,
            data: {
                results: [{ id: 'd1' }],
                pagination: { page: 1 },
                media: {},
            },
        });
        expect(result.myDrafts.length).toBe(1);
    });

    it('handles MOMENT_DRAFT_CREATED by prepending', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.MOMENT_DRAFT_CREATED,
            data: { id: 'd1', isDraft: true },
        });
        expect(result.myDrafts.length).toBe(1);
    });

    it('handles MOMENT_DRAFT_DELETED', () => {
        const populated = reducer(initialState, {
            type: ContentActionTypes.SEARCH_MY_DRAFTS,
            data: {
                results: [{ id: 'd1' }, { id: 'd2' }],
                pagination: {},
                media: {},
            },
        });
        const result = reducer(populated, {
            type: ContentActionTypes.MOMENT_DRAFT_DELETED,
            data: { id: 'd1' },
        });
        expect(result.myDrafts.length).toBe(1);
        expect(result.myDrafts[0].id).toBe('d2');
    });

    // Other
    it('handles FETCH_MEDIA', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.FETCH_MEDIA,
            data: { m1: { url: 'url1' } },
        });
        expect(result.media.m1.url).toBe('url1');
    });

    it('handles SET_ACTIVE_AREAS_FILTERS', () => {
        const result = reducer(initialState, {
            type: ContentActionTypes.SET_ACTIVE_AREAS_FILTERS,
            data: { order: 'ASC', category: 'food' },
        });
        expect(result.activeAreasFilters.order).toBe('ASC');
        expect(result.activeAreasFilters.category).toBe('food');
    });

    // Logout
    it('handles LOGOUT by clearing content', () => {
        const populated = reducer(initialState, {
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: [{ id: 'e1' }],
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(Array.from(result.activeMoments)).toEqual([]);
        expect(Array.from(result.activeSpaces)).toEqual([]);
        expect(Array.from(result.activeThoughts)).toEqual([]);
        expect(Array.from(result.bookmarkedMoments)).toEqual([]);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
