import * as Immutable from 'seamless-immutable';

type IAccessLevel = Array<string>;

export interface IUser {
  accessLevels: IAccessLevel;
  id: string;
  idToken: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userName: string;
}

export interface IUserState extends Immutable.ImmutableObject<any> {
  details: IUser;
  isAuthenticated: boolean;
}
