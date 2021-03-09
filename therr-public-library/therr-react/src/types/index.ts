import {
    // Index
    ISearchQuery,

    // Maps
    IMapState,
    MapActionTypes,

    // Forums
    IForum,
    IForumsArray,
    IForumsState,
    ForumActionTypes,

    // Messages
    MessageActionTypes,
    IForumMsg,
    IForumMsgList,
    IForumMsgs,
    IDirectMsg,
    IMessagesState,

    // Notifications
    INotification,
    INotificationsState,
    NotificationActionTypes,

    // Reactions
    IReactionsState,
    ReactionActionTypes,

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

export {
    // Index
    ISearchQuery,

    // Forums
    IForum,
    IForumsArray,
    IForumsState,
    ForumActionTypes,

    // Maps
    IMapState,
    MapActionTypes,

    // Messages
    IMessagesState,
    MessageActionTypes,
    IForumMsg,
    IForumMsgList,
    IForumMsgs,
    IDirectMsg,

    // Notifications
    INotification,
    INotificationsState,
    NotificationActionTypes,

    // Reactions
    IReactionsState,
    ReactionActionTypes,

    // User
    IUser,
    ISocketDetails,
    IUserState,

    // User Connections
    IUserConnection,
    IUserConnectionsState,
    UserConnectionActionTypes,
};
