import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import reducer from '../map';
import { MapActionTypes } from '../../../types/redux/maps';
import { ContentActionTypes } from '../../../types/redux/content';

describe('map reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(initialState.activityGeneration).toBeDefined();
        expect(initialState.events).toBeDefined();
        expect(initialState.moments).toBeDefined();
        expect(initialState.spaces).toBeDefined();
        expect(initialState.radiusOfAwareness).toBeDefined();
        expect(initialState.radiusOfInfluence).toBeDefined();
    });

    // Activity
    it('handles GENERATE_ACTIVITY', () => {
        const data = { topConnections: [], topSpaces: [] };
        const result = reducer(initialState, {
            type: MapActionTypes.GENERATE_ACTIVITY,
            data,
        });
        expect(result.activityGeneration).toEqual(data);
    });

    // Events
    it('handles GET_EVENTS', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.GET_EVENTS,
            data: {
                results: [
                    { id: 'e1', longitude: 1, latitude: 1 },
                    { id: 'e2', longitude: 2, latitude: 2 },
                ],
            },
        });
        expect(result.events.e1).toBeDefined();
        expect(result.events.e2).toBeDefined();
    });

    it('handles GET_EVENTS filters items without coordinates', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.GET_EVENTS,
            data: {
                results: [
                    { id: 'e1', longitude: 1, latitude: 1 },
                    { id: 'e2' }, // no coords
                ],
            },
        });
        expect(result.events.e1).toBeDefined();
        expect(result.events.e2).toBeUndefined();
    });

    it('handles GET_EVENT_DETAILS for new event', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.GET_EVENT_DETAILS,
            data: { event: { id: 'e1', title: 'Test' } },
        });
        expect(result.events.e1.title).toBe('Test');
    });

    it('handles GET_EVENT_DETAILS for existing event (merges)', () => {
        const populated = reducer(initialState, {
            type: MapActionTypes.GET_EVENTS,
            data: {
                results: [{
                    id: 'e1', longitude: 1, latitude: 1, title: 'Old',
                }],
            },
        });
        const result = reducer(populated, {
            type: MapActionTypes.GET_EVENT_DETAILS,
            data: { event: { id: 'e1', title: 'Updated' } },
        });
        expect(result.events.e1.title).toBe('Updated');
        expect(result.events.e1.longitude).toBe(1);
    });

    it('handles EVENT_CREATED', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.EVENT_CREATED,
            data: { id: 'e1', title: 'New' },
        });
        expect(result.events.e1.title).toBe('New');
    });

    it('handles EVENT_DELETED', () => {
        const populated = reducer(initialState, {
            type: MapActionTypes.EVENT_CREATED,
            data: { id: 'e1' },
        });
        const result = reducer(populated, {
            type: MapActionTypes.EVENT_DELETED,
            data: { id: 'e1' },
        });
        expect(result.events.e1).toBeUndefined();
    });

    // Moments
    it('handles GET_MOMENTS', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.GET_MOMENTS,
            data: {
                results: [{ id: 'm1', longitude: 1, latitude: 1 }],
            },
        });
        expect(result.moments.m1).toBeDefined();
    });

    it('handles MOMENT_CREATED', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.MOMENT_CREATED,
            data: { id: 'm1', title: 'New Moment' },
        });
        expect(result.moments.m1.title).toBe('New Moment');
    });

    it('handles MOMENT_DELETED', () => {
        const populated = reducer(initialState, {
            type: MapActionTypes.MOMENT_CREATED,
            data: { id: 'm1' },
        });
        const result = reducer(populated, {
            type: MapActionTypes.MOMENT_DELETED,
            data: { id: 'm1' },
        });
        expect(result.moments.m1).toBeUndefined();
    });

    // Spaces
    it('handles GET_SPACES', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.GET_SPACES,
            data: {
                results: [{ id: 's1', longitude: 1, latitude: 1 }],
            },
        });
        expect(result.spaces.s1).toBeDefined();
    });

    it('handles LIST_SPACES (resets to fresh object)', () => {
        const populated = reducer(initialState, {
            type: MapActionTypes.GET_SPACES,
            data: {
                results: [{ id: 's1', longitude: 1, latitude: 1 }],
            },
        });
        const result = reducer(populated, {
            type: MapActionTypes.LIST_SPACES,
            data: {
                results: [{ id: 's2', name: 'Listed' }],
            },
        });
        expect(result.spaces.s1).toBeUndefined();
        expect(result.spaces.s2.name).toBe('Listed');
    });

    it('handles SPACE_CREATED', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.SPACE_CREATED,
            data: { id: 's1', title: 'New Space' },
        });
        expect(result.spaces.s1.title).toBe('New Space');
    });

    it('handles SPACE_DELETED', () => {
        const populated = reducer(initialState, {
            type: MapActionTypes.SPACE_CREATED,
            data: { id: 's1' },
        });
        const result = reducer(populated, {
            type: MapActionTypes.SPACE_DELETED,
            data: { id: 's1' },
        });
        expect(result.spaces.s1).toBeUndefined();
    });

    it('handles UPDATE_RECENT_ENGAGEMENTS', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.UPDATE_RECENT_ENGAGEMENTS,
            data: { spaceId: 's1', type: 'check-in' },
        });
        expect(result.recentEngagements.s1.type).toBe('check-in');
    });

    // Map view
    it('handles UPDATE_MAP_VIEW_COORDS', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.UPDATE_MAP_VIEW_COORDS,
            data: {
                longitude: 10, latitude: 20, longitudeDelta: 0.1, latitudeDelta: 0.1,
            },
        });
        expect(result.longitude).toBe(10);
        expect(result.latitude).toBe(20);
    });

    it('handles UPDATE_USER_RADIUS', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.UPDATE_USER_RADIUS,
            data: { radiusOfAwareness: 100, radiusOfInfluence: 50 },
        });
        expect(result.radiusOfAwareness).toBe(100);
        expect(result.radiusOfInfluence).toBe(50);
    });

    it('handles USER_LOCATION_DETERMINED', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.USER_LOCATION_DETERMINED,
        });
        expect(result.hasUserLocationLoaded).toBe(true);
    });

    it('handles AUTOCOMPLETE_UPDATE', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.AUTOCOMPLETE_UPDATE,
            data: { predictions: [{ description: 'Place 1' }] },
        });
        expect(result.searchPredictions.results.length).toBe(1);
    });

    it('handles SET_DROPDOWN_VISIBILITY', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.SET_DROPDOWN_VISIBILITY,
            data: { isSearchDropdownVisible: true },
        });
        expect(result.searchPredictions.isSearchDropdownVisible).toBe(true);
    });

    it('handles SET_MAP_FILTERS', () => {
        const result = reducer(initialState, {
            type: MapActionTypes.SET_MAP_FILTERS,
            data: {
                filtersAuthor: ['author1'],
                filtersCategory: ['cat1'],
            },
        });
        expect(result.filtersAuthor).toEqual(['author1']);
        expect(result.filtersCategory).toEqual(['cat1']);
    });

    // Logout
    it('handles LOGOUT by clearing key state', () => {
        const populated = reducer(initialState, {
            type: MapActionTypes.EVENT_CREATED,
            data: { id: 'e1' },
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(Object.keys(result.moments)).toHaveLength(0);
        expect(Object.keys(result.spaces)).toHaveLength(0);
        expect(Object.keys(result.events)).toHaveLength(0);
        expect(result.hasUserLocationLoaded).toBe(false);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
