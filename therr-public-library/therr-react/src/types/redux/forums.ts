import * as Immutable from 'seamless-immutable';

export interface IForum {
    roomKey: string;
    sockets: any;
    length: number;
}

export type IForumsArray = Immutable.ImmutableArray<IForum>;

export interface IForumsState extends Immutable.ImmutableObject<any> {
    activeForums: any;
    forumCategories: any;
    myForumsSearchResults: any;
    myForumsPagination: any;
    searchResults: any;
    pagination: any;
}

export enum ForumActionTypes {
    CREATE_FORUM = 'CREATE_FORUM',
    UPDATE_FORUM = 'UPDATE_FORUM',
    DELETE_FORUM = 'DELETE_FORUM',
    SEARCH_FORUMS = 'SEARCH_FORUMS',
    SEARCH_FORUM_CATEGORIES = 'SEARCH_FORUM_CATEGORIES',
}
