import {
    INotification,
    INotificationsState,
    NotificationActionTypes,
} from './notifications';
import {
    IMapState,
    MapActionTypes,
} from './maps';
import {
    IForum,
    IForumsArray,
    IForumMsg,
    IForumMsgList,
    IForumMsgs,
    IMessagesState,
    MessageActionTypes,
} from './messages';
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
    // Maps
    IMapState,
    MapActionTypes,

    // Messages
    IForum,
    IForumsArray,
    IForumMsg,
    IForumMsgList,
    IForumMsgs,
    IMessagesState,
    MessageActionTypes,

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
