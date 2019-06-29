import axios from 'axios';

interface ILoginCredentials {
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
}

export default new UserService();
