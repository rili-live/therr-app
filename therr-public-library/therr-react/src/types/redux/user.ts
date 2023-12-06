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

export interface IAchievementsState extends Immutable.ImmutableObject<any> { [key: string]: any }

export interface IUserState extends Immutable.ImmutableObject<any> {
  achievements: IAchievementsState;
  details: IUser;
  settings: IUserSettings;
  socketDetails: ISocketDetails;
  isAuthenticated: boolean;
  userInView: IUser;
  thoughts: any;
  myThoughts: any;
  users: any;
}

export enum UserActionTypes {
  GET_MY_ACHIEVEMENTS = 'GET_MY_ACHIEVEMENTS',
  UPDATE_MY_ACHIEVEMENTS = 'UPDATE_MY_ACHIEVEMENTS',
  GET_USER = 'GET_USER',
  GET_USERS = 'GET_USERS',
  GET_USERS_REFETCH = 'GET_USERS_REFETCH',
  GET_USERS_UPDATE = 'GET_USERS_UPDATE',
  GET_USERS_PAIRINGS = 'GET_USERS_PAIRINGS',
  LOGIN = 'LOGIN',
  UPDATE_USER_TOUR = 'UPDATE_USER_TOUR',
  UPDATE_USER_FTUI = 'UPDATE_USER_FTUI',
  UPDATE_USER_POINTS = 'UPDATE_USER_POINTS',
  UPDATE_USER_IN_VIEW = 'UPDATE_USER_IN_VIEW',
  THOUGHT_CREATED = 'THOUGHT_CREATED',
  GET_THOUGHT_DETAILS = 'GET_THOUGHT_DETAILS',
  GET_THOUGHTS = 'GET_THOUGHTS',
  GET_MY_THOUGHTS = 'GET_MY_THOUGHTS',
  THOUGHT_DELETED = 'THOUGHT_DELETED'
}
