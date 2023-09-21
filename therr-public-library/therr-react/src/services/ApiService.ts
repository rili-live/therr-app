/* eslint-disable class-methods-use-this */
import axios from 'axios';

class ApiService {
    verifyPhone = (phoneNumber) => axios({
        method: 'post',
        url: '/phone/verify',
        data: {
            phoneNumber,
        },
    })

    validateCode = (verificationCode) => axios({
        method: 'post',
        url: '/phone/validate-code',
        data: {
            verificationCode,
        },
    })
}

export default new ApiService();
