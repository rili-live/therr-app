export interface IForum {
    roomKey: string;
    sockets: any;
    length: number;
}

export type IForumsArray = IForum[];

export interface IForumsState {
    activeForums: any;
    forumCategories: any;
    forumDetails: Record<string, any>;
    myForumsSearchResults: any;
    myForumsPagination: any;
    searchResults: any;
    pagination: any;
}

export enum ForumActionTypes {
    CREATE_FORUM = 'CREATE_FORUM',
    UPDATE_FORUM = 'UPDATE_FORUM',
    DELETE_FORUM = 'DELETE_FORUM',
    GET_FORUM_DETAILS = 'GET_FORUM_DETAILS',
    SEARCH_FORUMS = 'SEARCH_FORUMS',
    SEARCH_FORUM_CATEGORIES = 'SEARCH_FORUM_CATEGORIES',
}
