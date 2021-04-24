import * as Immutable from 'seamless-immutable';

export interface IContentState extends Immutable.ImmutableObject<any> {
    activeMoments: any;
}

export enum ContentActionTypes {
    INSERT_ACTIVE_MOMENTS = 'INSERT_ACTIVE_MOMENTS',
    SEARCH_ACTIVE_MOMENTS = 'SEARCH_ACTIVE_MOMENTS',
    UPDATE_ACTIVE_MOMENTS = 'UPDATE_ACTIVE_MOMENTS',
}
