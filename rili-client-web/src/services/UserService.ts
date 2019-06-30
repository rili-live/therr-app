import axios from 'axios';

interface ILoginCredentials {
  userName: String;
  password: String;
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
}

export default new UserService();
