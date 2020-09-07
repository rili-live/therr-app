import {
    // Messages
    IForum,
    IForumsArray,
    MessageActionTypes,
    IForumMsg,
    IForumMsgList,
    IForumMsgs,
    IMessagesState,

    // Notifications
    INotification,
    INotificationsState,
    NotificationActionTypes,

    // Users
    IUser,
    ISocketDetails,
    IUserState,

    // User Connections
    IUserConnection,
    IUserConnectionsState,
    UserConnectionActionTypes,
} from './redux';

export enum AccessCheckType {
    ALL = 'all', // User has all of the access levels from the check
    ANY = 'any', // User has at least one of the access levels from the check
    NONE = 'none', // User does not have any of the access levels from the check
}

export interface IAccess {
    type: AccessCheckType;
    levels: Array<string>;
}

export interface ISearchQuery {
    filterBy?: string;
    filterOperator?: string;
    query?: string;
    itemsPerPage?: number;
    pageNumber?: number;
    returning?: string;
    shouldCheckReverse?: string;
}

export {
    // Messages
    IMessagesState,
    MessageActionTypes,
    IForum,
    IForumsArray,
    IForumMsg,
    IForumMsgList,
    IForumMsgs,

    // Notifications
    INotification,
    INotificationsState,
    NotificationActionTypes,

    // User
    IUser,
    ISocketDetails,
    IUserState,

    // User Connections
    IUserConnection,
    IUserConnectionsState,
    UserConnectionActionTypes,
};
