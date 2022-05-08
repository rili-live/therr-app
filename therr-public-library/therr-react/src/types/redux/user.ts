import * as Immutable from 'seamless-immutable';

type IAccessLevel = Array<string>;

export type IMobileThemeName = 'retro';

export interface IUser extends Immutable.ImmutableObject<any>{
  accessLevels: IAccessLevel;
  id: string;
  idToken: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userName: string;
  media?: any;
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
  UPDATE_USER_TOUR = 'UPDATE_USER_TOUR',
  UPDATE_USER_FTUI = 'UPDATE_USER_FTUI',
}
