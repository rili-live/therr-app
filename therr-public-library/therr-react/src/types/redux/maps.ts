import * as Immutable from 'seamless-immutable';

export interface IMapState extends Immutable.ImmutableObject<any> {
    hasUserLocationLoaded?: boolean;
    longitude?: number;
    latitude?: number;
    activities: { [id: string]: any };
    activityGeneration: { [id: string]: any };
    events: { [id: string]: any };
    moments: { [id: string]: any };
    spaces: { [id: string]: any };
    radiusOfAwareness: number,
    radiusOfInfluence: number,
    recentEngagements: { [id: string]: any };
    searchPredictions: any;
    filtersAuthor: any,
    filtersCategory: any,
    filtersVisibility: any,
}

export enum MapActionTypes {
    // Activities
    GENERATE_ACTIVITY = 'GENERATE_ACTIVITY',

    // Events
    EVENT_CREATED = 'EVENT_CREATED',
    EVENT_UPDATED = 'EVENT_UPDATED',
    EVENT_DELETED = 'EVENT_DELETED',
    GET_EVENT_DETAILS = 'GET_EVENT_DETAILS',
    GET_EVENTS = 'GET_EVENTS',
    GET_MY_EVENTS = 'GET_MY_EVENTS',

    // Moments
    MOMENT_CREATED = 'MOMENT_CREATED',
    MOMENT_UPDATED = 'MOMENT_UPDATED',
    MOMENT_DELETED = 'MOMENT_DELETED',
    GET_MOMENT_DETAILS = 'GET_MOMENT_DETAILS',
    GET_MOMENTS = 'GET_MOMENTS',
    GET_MY_MOMENTS = 'GET_MY_MOMENTS',

    // Spaces
    SPACE_CREATED = 'SPACE_CREATED',
    SPACE_UPDATED = 'SPACE_UPDATED',
    SPACE_DELETED = 'SPACE_DELETED',
    GET_SPACE_DETAILS = 'GET_SPACE_DETAILS',
    LIST_SPACES = 'LIST_SPACES',
    GET_SPACES = 'GET_SPACES',
    GET_MY_SPACES = 'GET_MY_SPACES',

    // Location
    USER_LOCATION_DETERMINED = 'USER_LOCATION_DETERMINED',
    UPDATE_USER_COORDS = 'UPDATE_USER_COORDS',
    UPDATE_USER_RADIUS = 'UPDATE_USER_RADIUS',
    UPDATE_MAP_VIEW_COORDS = 'UPDATE_MAP_VIEW_COORDS',

    // Filters
    SET_MAP_FILTERS = 'SET_MAP_FILTERS',

    // Rewards
    UPDATE_RECENT_ENGAGEMENTS = 'UPDATE_RECENT_ENGAGEMENTS',

    // Google API
    AUTOCOMPLETE_UPDATE = 'AUTOCOMPLETE_UPDATE',
    SET_DROPDOWN_VISIBILITY = 'SET_DROPDOWN_VISIBILITY',
}
