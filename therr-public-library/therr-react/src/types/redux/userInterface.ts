import * as Immutable from 'seamless-immutable';

export interface IUserInterfaceState extends Immutable.ImmutableObject<any> {
    details: any;
}

export enum UserInterfaceActionTypes {
    UPDATE_CLICK_TARGET = 'UPDATE_CLICK_TARGET',
}
