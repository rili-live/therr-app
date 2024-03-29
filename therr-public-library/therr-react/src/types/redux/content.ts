import * as Immutable from 'seamless-immutable';

export interface IContentState extends Immutable.ImmutableObject<any> {
    activeEvents: any;
    activeEventsPagination: any;
    bookmarkedEvents: any;
    activeMoments: any;
    activeMomentsPagination: any;
    bookmarkedMoments: any;
    activeSpaces: any;
    activeSpacesPagination: any;
    bookmarkedSpaces: any;
    activeThoughts: any;
    activeThoughtsPagination: any;
    bookmarkedThoughts: any;
    myDrafts: any;
    myDraftsPagination: any;

    activeAreasFilters: any;
    media: any;
}

export enum ContentActionTypes {
    FETCH_MEDIA = 'FETCH_MEDIA',
    SET_ACTIVE_AREAS_FILTERS = 'SET_ACTIVE_AREAS_FILTERS',
    SEARCH_MY_DRAFTS = 'SEARCH_MY_DRAFTS',

    // Events
    INSERT_ACTIVE_EVENTS = 'INSERT_ACTIVE_EVENTS',
    REMOVE_ACTIVE_EVENTS = 'REMOVE_ACTIVE_EVENTS',
    SEARCH_ACTIVE_EVENTS = 'SEARCH_ACTIVE_EVENTS',
    SEARCH_ACTIVE_EVENTS_BY_IDS = 'SEARCH_ACTIVE_EVENTS_BY_IDS',
    UPDATE_ACTIVE_EVENTS = 'UPDATE_ACTIVE_EVENTS',
    UPDATE_ACTIVE_EVENT_REACTION = 'UPDATE_ACTIVE_EVENT_REACTION',
    SEARCH_BOOKMARKED_EVENTS = 'SEARCH_BOOKMARKED_EVENTS',
    EVENT_DRAFT_CREATED = 'EVENT_DRAFT_CREATED',
    EVENT_DRAFT_DELETED = 'EVENT_DRAFT_DELETED',

    // Moments
    INSERT_ACTIVE_MOMENTS = 'INSERT_ACTIVE_MOMENTS',
    REMOVE_ACTIVE_MOMENTS = 'REMOVE_ACTIVE_MOMENTS',
    SEARCH_ACTIVE_MOMENTS = 'SEARCH_ACTIVE_MOMENTS',
    SEARCH_ACTIVE_MOMENTS_BY_IDS = 'SEARCH_ACTIVE_MOMENTS_BY_IDS',
    UPDATE_ACTIVE_MOMENTS = 'UPDATE_ACTIVE_MOMENTS',
    UPDATE_ACTIVE_MOMENT_REACTION = 'UPDATE_ACTIVE_MOMENT_REACTION',
    SEARCH_BOOKMARKED_MOMENTS = 'SEARCH_BOOKMARKED_MOMENTS',
    MOMENT_DRAFT_CREATED = 'MOMENT_DRAFT_CREATED',
    MOMENT_DRAFT_DELETED = 'MOMENT_DRAFT_DELETED',

    // Spaces
    UPDATE_ACTIVE_SPACE_REACTION = 'UPDATE_ACTIVE_SPACE_REACTION',
    INSERT_ACTIVE_SPACES = 'INSERT_ACTIVE_SPACES',
    REMOVE_ACTIVE_SPACES = 'REMOVE_ACTIVE_SPACES',
    SEARCH_ACTIVE_SPACES = 'SEARCH_ACTIVE_SPACES',
    SEARCH_ACTIVE_SPACES_BY_IDS = 'SEARCH_ACTIVE_SPACES_BY_IDS',
    UPDATE_ACTIVE_SPACES = 'UPDATE_ACTIVE_SPACES',
    SEARCH_BOOKMARKED_SPACES = 'SEARCH_BOOKMARKED_SPACES',

    // Thoughts
    UPDATE_ACTIVE_THOUGHT_REACTION = 'UPDATE_ACTIVE_THOUGHT_REACTION',
    INSERT_ACTIVE_THOUGHTS = 'INSERT_ACTIVE_THOUGHTS',
    REMOVE_ACTIVE_THOUGHTS = 'REMOVE_ACTIVE_THOUGHTS',
    SEARCH_ACTIVE_THOUGHTS = 'SEARCH_ACTIVE_THOUGHTS',
    UPDATE_ACTIVE_THOUGHTS = 'UPDATE_ACTIVE_THOUGHTS',
    SEARCH_BOOKMARKED_THOUGHTS = 'SEARCH_BOOKMARKED_THOUGHTS',
}
