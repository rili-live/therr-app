import * as Immutable from 'seamless-immutable';

export interface INotification {
    id: number;
    userId: number;
    type: string;
    associationId?: number;
    isUnread: boolean;
    message: string;
    messageParams?: any;
    userConnection?: any;
}

export interface INotificationsState extends Immutable.ImmutableObject<any> {
    messages: any;
}

export enum NotificationActionTypes {
    GET_NOTIFICATIONS = 'GET_NOTIFICATIONS',
}
