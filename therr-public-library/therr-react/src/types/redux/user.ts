import * as Immutable from 'seamless-immutable';

type IAccessLevel = Array<string>;

export type IMobileThemeName = 'retro';

export interface IUser extends Immutable.ImmutableObject<any>{
  accessLevels: IAccessLevel;
  id: number;
  idToken: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userName: string;
}

export interface IUserSettings extends Immutable.ImmutableObject<any>{
  locale: string;
  mobileThemeName: string;
}

export interface ISocketDetails extends Immutable.ImmutableObject<any> {
  userName?: string;
  currentRoom?: string;
  session?: any;
}

export interface IUserState extends Immutable.ImmutableObject<any> {
  details: IUser;
  settings: IUserSettings;
  socketDetails: ISocketDetails;
  isAuthenticated: boolean;
}

export enum UserActionTypes {
  LOGIN = 'LOGIN',
}
