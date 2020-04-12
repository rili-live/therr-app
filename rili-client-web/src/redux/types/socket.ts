import * as Immutable from 'seamless-immutable';

export interface IForum {
    roomKey: string;
    sockets: any;
    length: number;
}

export type IForumsArray = Immutable.ImmutableArray<IForum>;

export interface IMessage {
    key: string;
    time: string;
    text: string;
}
export type IMessageList = Immutable.ImmutableArray<IMessage>;
export type IMessages = Immutable.ImmutableObject<{[index: string]: IMessageList}>;

export interface ISocketState extends Immutable.ImmutableObject<any> {
    forums: any;
    messages: any;
}
