import axios from 'axios';

class VerificationCodesService {
    verifyEmail = (token: string) => axios({
        method: 'post',
        url: `/users-service/users/verify/${token}`,
        data: {
            type: 'email',
        },
    });
}

export default new VerificationCodesService();
