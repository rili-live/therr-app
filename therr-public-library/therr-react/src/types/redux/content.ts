import * as Immutable from 'seamless-immutable';

export interface IContentState extends Immutable.ImmutableObject<any> {
    activeMoments: any;
    activeMomentsFilters: any;
    activeMomentsPagination: any;
    bookmarkedMoments: any;
    media: any;
}

export enum ContentActionTypes {
    INSERT_ACTIVE_MOMENTS = 'INSERT_ACTIVE_MOMENTS',
    REMOVE_ACTIVE_MOMENTS = 'REMOVE_ACTIVE_MOMENTS',
    SEARCH_ACTIVE_MOMENTS = 'SEARCH_ACTIVE_MOMENTS',
    SET_ACTIVE_MOMENTS_FILTERS = 'SET_ACTIVE_MOMENTS_FILTERS',
    UPDATE_ACTIVE_MOMENTS = 'UPDATE_ACTIVE_MOMENTS',
    UPDATE_ACTIVE_MOMENT_REACTION = 'UPDATE_ACTIVE_MOMENT_REACTION',
    SEARCH_BOOKMARKED_MOMENTS = 'SEARCH_BOOKMARKED_MOMENTS',

    // Spaces
    UPDATE_ACTIVE_SPACE_REACTION = 'UPDATE_ACTIVE_SPACE_REACTION',
    INSERT_ACTIVE_SPACES = 'INSERT_ACTIVE_SPACES',
    REMOVE_ACTIVE_SPACES = 'REMOVE_ACTIVE_SPACES',
}
