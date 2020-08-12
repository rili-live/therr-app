import axios from 'axios';
// import {
//     IAccess,
//     AccessCheckType,
//     IUserState,
// } from '../types';

// TODO: RSERV-36 - Configure types
class MessagesService {
    searchMessages = (searchParams: any) => axios({
        method: 'post',
        url: '/messages-service/direct-messages',
        data: searchParams,
    })
}

export default new MessagesService();
