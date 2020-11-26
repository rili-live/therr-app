import * as Immutable from 'seamless-immutable';

export interface IMapState extends Immutable.ImmutableObject<any> {
    moments: any;
    myMoments: any;
}

export enum MapActionTypes {
    MOMENT_CREATED = 'MOMENT_CREATED',
    MOMENT_UPDATED = 'MOMENT_UPDATED',
    GET_MOMENTS = 'GET_MOMENTS',
}
