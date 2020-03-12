import * as Immutable from 'seamless-immutable';

export interface IRoom {
    roomKey: string;
    sockets: any;
    length: number;
}

export type IRoomsArray = Immutable.ImmutableArray<IRoom>;

export interface IMessage {
    key: string;
    time: string;
    text: string;
}
export type IMessageList = Immutable.ImmutableArray<IMessage>;
export type IMessages = Immutable.ImmutableObject<{[index: string]: IMessageList}>;

export interface ISocketUser {
    userName: string;
    currentRoom: string;
    session: any;
}

export interface ISocketState extends Immutable.ImmutableObject<any> {
    user: any;
    rooms: any;
    messages: any;
}