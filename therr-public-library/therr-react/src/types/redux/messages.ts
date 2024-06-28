import * as Immutable from 'seamless-immutable';

export interface IDirectMsg {
    key: number | string;
    fromUserName: string;
    fromUserImgSrc: string;
    text: string;
    time: string;
    isAnnouncement?: boolean;
}

export interface IForumMsg {
    key: string;
    fromUserName: string;
    fromUserImgSrc: string;
    time: string;
    text: string;
    isAnnouncement?: boolean;
}

export type IForumMsgList = Immutable.ImmutableArray<IForumMsg>;
export type IForumMsgs = Immutable.ImmutableObject<{[index: string]: IForumMsgList}>;

export interface IMessagesState extends Immutable.ImmutableObject<any> {
    forums: Immutable.ImmutableArray<any>;
    dms: {
        [key: string]: IDirectMsg;
    } | {};
    myDMs: any;
    forumMsgs: {
        [key: string]: IForumMsg;
    } | {};
}

export enum MessageActionTypes {
    GET_DIRECT_MESSAGES = 'GET_DIRECT_MESSAGES',
    GET_MORE_DIRECT_MESSAGES = 'GET_MORE_DIRECT_MESSAGES',
    GET_MY_DIRECT_MESSAGES = 'GET_MY_DIRECT_MESSAGES',
    GET_MORE_OF_MY_DIRECT_MESSAGES = 'GET_MORE_OF_MY_DIRECT_MESSAGES',
    GET_FORUM_MESSAGES = 'GET_FORUM_MESSAGES',
}
