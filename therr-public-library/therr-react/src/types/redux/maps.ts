import * as Immutable from 'seamless-immutable';

export interface IMapState extends Immutable.ImmutableObject<any> {
    hasUserLocationLoaded?: boolean;
    longitude?: number;
    latitude?: number;
    moments: any;
    myMoments: any;
    spaces: any;
    mySpaces: any;
    searchPredictions: any;
}

export enum MapActionTypes {
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
    GET_SPACES = 'GET_SPACES',
    GET_MY_SPACES = 'GET_MY_SPACES',

    // Location
    USER_LOCATION_DETERMINED = 'USER_LOCATION_DETERMINED',
    UPDATE_COORDS = 'UPDATE_COORDS',

    // Google API
    AUTOCOMPLETE_UPDATE = 'AUTOCOMPLETE_UPDATE',
    SET_DROPDOWN_VISIBILITY = 'SET_DROPDOWN_VISIBILITY',
}
