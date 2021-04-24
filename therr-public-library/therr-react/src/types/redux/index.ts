import {
    IContentState,
    ContentActionTypes,
} from './content';
import {
    IForum,
    IForumsArray,
    IForumsState,
    ForumActionTypes,
} from './forums';
import {
    IMapState,
    MapActionTypes,
} from './maps';
import {
    IForumMsg,
    IForumMsgList,
    IForumMsgs,
    IDirectMsg,
    IMessagesState,
    MessageActionTypes,
} from './messages';
import {
    INotification,
    INotificationsState,
    NotificationActionTypes,
} from './notifications';
import {
    IReactionsState,
    ReactionActionTypes,
} from './reactions';
import {
    IUser,
    ISocketDetails,
    IUserState,
} from './user';
import {
    IUserConnection,
    IUserConnectionsState,
    UserConnectionActionTypes,
} from './userConnections';

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
    longitude?: number;
    latitude?: number;
}

export {
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
    IForumMsg,
    IForumMsgList,
    IForumMsgs,
    IDirectMsg,
    IMessagesState,
    MessageActionTypes,

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
