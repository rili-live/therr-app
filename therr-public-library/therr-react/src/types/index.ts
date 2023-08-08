import {
    // Content
    IContentState,
    ContentActionTypes,

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
    IMobileThemeName,

    // User Connections
    IUserConnection,
    IUserConnectionsState,
    UserConnectionActionTypes,

    // User Interface
    IUserInterfaceState,
    UserInterfaceActionTypes,
} from './redux';

enum AccessCheckType {
    ALL = 'all', // User has all of the access levels from the check
    ANY = 'any', // User has at least one of the access levels from the check
    NONE = 'none', // User does not have any of the access levels from the check
}

interface IAccess {
    type: AccessCheckType;
    levels: Array<string>;
    isPublic?: boolean;
}

interface ISearchQuery {
    filterBy?: string;
    filterOperator?: string;
    query?: string;
    itemsPerPage?: number;
    pageNumber?: number;
    returning?: string;
    shouldCheckReverse?: string;
    withMedia?: string;
    longitude?: number;
    latitude?: number;
}

export {
    // Auth
    AccessCheckType,
    IAccess,
    ISearchQuery,

    // Content
    IContentState,
    ContentActionTypes,

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
    IMobileThemeName,

    // User Connections
    IUserConnection,
    IUserConnectionsState,
    UserConnectionActionTypes,

    // User Interface
    IUserInterfaceState,
    UserInterfaceActionTypes,
};
