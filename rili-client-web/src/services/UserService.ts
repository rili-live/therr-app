import axios from 'axios';
import { IAccess, AccessCheckType } from '../routes';
import { IUserState } from 'types/user';

interface ILoginCredentials {
  userName: String;
  password: String;
}

interface ILogoutCredentials {
  userName: String;
}

interface IRegisterCredentials {
  firstName: String;
  lastName: String;
  email: String;
  phoneNumber: String;
  userName: String;
  password: String;
}

class UserService {
  authenticate = (data: ILoginCredentials) => {
    return axios({
      method: 'post',
      url: '/auth',
      data,
    });
  }

  create = (data: IRegisterCredentials) => {
    return axios({
      method: 'post',
      url: '/users',
      data,
    });
  }

  isAuthorized = (access: IAccess, user: IUserState) => {
    if (user && user.details && user.details.accessLevels) {
        if (access.type === AccessCheckType.NONE) {
            // User does not have any of the access levels from the check
            return !access.levels.some(lvl => user.details.accessLevels.includes(lvl));
        }
        if (access.type === AccessCheckType.ANY) {
            // User has at least one of the access levels from the check
            return access.levels.some(lvl => user.details.accessLevels.includes(lvl));
        }
        if (access.type === AccessCheckType.ALL) {
            // User has all of the access levels from the check
            return !access.levels.some(lvl => !user.details.accessLevels.includes(lvl));
        }
    }

    return false;
  }
  
  logout = (data: ILogoutCredentials) => {
    return axios({
      method: 'post',
      url: '/auth/logout',
      data,
    });
  }
}

export default new UserService();
