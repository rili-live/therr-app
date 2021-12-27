import * as Immutable from 'seamless-immutable';

export interface IContentState extends Immutable.ImmutableObject<any> {
    activeMoments: any;
    activeMomentsPagination: any;
    bookmarkedMoments: any;
    activeSpaces: any;
    activeSpacesPagination: any;
    bookmarkedSpaces: any;

    activeAreasFilters: any;
    media: any;
}

export enum ContentActionTypes {
    INSERT_ACTIVE_MOMENTS = 'INSERT_ACTIVE_MOMENTS',
    REMOVE_ACTIVE_MOMENTS = 'REMOVE_ACTIVE_MOMENTS',
    SEARCH_ACTIVE_MOMENTS = 'SEARCH_ACTIVE_MOMENTS',
    SET_ACTIVE_AREAS_FILTERS = 'SET_ACTIVE_AREAS_FILTERS',
    UPDATE_ACTIVE_MOMENTS = 'UPDATE_ACTIVE_MOMENTS',
    UPDATE_ACTIVE_MOMENT_REACTION = 'UPDATE_ACTIVE_MOMENT_REACTION',
    SEARCH_BOOKMARKED_MOMENTS = 'SEARCH_BOOKMARKED_MOMENTS',

    // Spaces
    UPDATE_ACTIVE_SPACE_REACTION = 'UPDATE_ACTIVE_SPACE_REACTION',
    INSERT_ACTIVE_SPACES = 'INSERT_ACTIVE_SPACES',
    REMOVE_ACTIVE_SPACES = 'REMOVE_ACTIVE_SPACES',
    SEARCH_ACTIVE_SPACES = 'SEARCH_ACTIVE_SPACES',
    UPDATE_ACTIVE_SPACES = 'UPDATE_ACTIVE_SPACES',
    SEARCH_BOOKMARKED_SPACES = 'SEARCH_BOOKMARKED_SPACES',
}
