type IAccessLevel = Array<string>;

export type IMobileThemeName = 'retro';

export interface IUser {
  accessLevels: IAccessLevel;
  id: string;
  idToken: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userName: string;
  media?: any;
  settingsTherrCoinTotal?: any;
  [key: string]: any;
}

export interface IUserSettings {
  locale: string;
  mobileThemeName: string;
  navigationTourCount?: number;
  settingsTherrCoinTotal?: any;
  [key: string]: any;
}

export interface ISocketDetails {
  userName?: string;
  currentRoom?: string;
  session?: any;
}

export interface IAchievementsState { [key: string]: any }

export interface IUserState {
  achievements: IAchievementsState;
  details: IUser;
  settings: IUserSettings;
  socketDetails: ISocketDetails;
  isAuthenticated: boolean;
  userInView: IUser;
  thoughts: any;
  myThoughts: any;
  users: any;
  usersMightKnow: any;
  influencerPairings: any;
  myUserGroups: any;
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
  THOUGHT_DELETED = 'THOUGHT_DELETED',
  USER_GROUP_CREATED = 'USER_GROUP_CREATED',
  USER_GROUP_UPDATED = 'USER_GROUP_UPDATED',
  USER_GROUP_DELETED = 'USER_GROUP_DELETED',
  GET_USER_GROUPS = 'GET_USER_GROUPS',
  GET_USER_INTERESTS = 'GET_USER_INTERESTS',
  USER_INTERESTS_UPDATED = 'USER_INTERESTS_UPDATED',
}
