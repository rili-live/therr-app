import * as Immutable from 'seamless-immutable';

export interface IMapState extends Immutable.ImmutableObject<any> {
    hasUserLocationLoaded?: boolean;
    longitude?: number;
    latitude?: number;
    moments: any;
    myMoments: any;
}

export enum MapActionTypes {
    MOMENT_CREATED = 'MOMENT_CREATED',
    MOMENT_UPDATED = 'MOMENT_UPDATED',
    MOMENT_DELETED = 'MOMENT_DELETED',
    GET_MOMENT_DETAILS = 'GET_MOMENT_DETAILS',
    GET_MOMENTS = 'GET_MOMENTS',
    GET_MY_MOMENTS = 'GET_MY_MOMENTS',
    USER_LOCATION_DETERMINED = 'USER_LOCATION_DETERMINED',
    UPDATE_COORDS = 'UPDATE_COORDS',
}
