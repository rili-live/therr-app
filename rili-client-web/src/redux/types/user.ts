import * as Immutable from 'seamless-immutable';

type IAccessLevel = Array<String>;

export interface IUser {
  accessLevels: IAccessLevel; 
  id: String;
  idToken: String;
  email: String;
  firstName: String;
  lastName: String;
  phoneNumber: String;
  userName: String;
}

export interface IUserState extends Immutable.ImmutableObject<any> {
  details: IUser;
}
