import * as Immutable from 'seamless-immutable';

export interface IForum {
    roomKey: string;
    sockets: any;
    length: number;
}

export type IForumsArray = Immutable.ImmutableArray<IForum>;

export interface IForumMsg {
    key: string;
    time: string;
    text: string;
}
export type IForumMsgList = Immutable.ImmutableArray<IForumMsg>;
export type IForumMsgs = Immutable.ImmutableObject<{[index: string]: IForumMsgList}>;

export interface IMessagesState extends Immutable.ImmutableObject<any> {
    dms: {
        [key: string]: {
            key: number | string;
            fromUserName: string;
            text: string;
            time: string;
        };
    } | {};
    forums: any;
    forumMsgs: {
        [key: string]: {
            key: number | string;
            fromUserName: string;
            text: string;
            time: string;
        };
    } | {};
}

export enum MessageActionTypes {
    CREATE_FORUM = 'CREATE_FORUM',
    GET_DIRECT_MESSAGES = 'GET_DIRECT_MESSAGES',
    GET_FORUM_MESSAGES = 'GET_FORUM_MESSAGES',
}
