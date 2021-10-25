import axios from 'axios';
import {
    IAccess,
    AccessCheckType,
    IUserState,
} from '../types';

interface ILoginCredentials {
    userName: string;
    password: string;
}

interface ILogoutCredentials {
    userName: string;
}

interface IRegisterCredentials {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    userName: string;
    password: string;
}

interface IUpdateUser {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    userName: string;
    password?: string;
    newPassword?: string;
    shouldHideMatureContent?: boolean;
}

interface IChangePasswordArgs {
    oldPassword: string;
    newPassword: string;
    email: string;
    userName: string;
}

class UsersService {
    authenticate = (data: ILoginCredentials) => axios({
        method: 'post',
        url: '/users-service/auth',
        data,
    })

    changePassword = (data: IChangePasswordArgs) => axios({
        method: 'put',
        url: '/users-service/users/change-password',
        data,
    })

    create = (data: IRegisterCredentials) => axios({
        method: 'post',
        url: '/users-service/users',
        data,
    })

    get = (id: number) => axios({
        method: 'get',
        url: `/users-service/users/${id}`,
    })

    report = (userId: string) => axios({
        method: 'put',
        url: `/users-service/users/${userId}/report`,
        data: {},
    })

    update = (userId: string, data: IUpdateUser) => axios({
        method: 'put',
        url: `/users-service/users/${userId}`,
        data,
    })

    isAuthorized = (access: IAccess, user: IUserState) => {
        const userAccessLevels = user?.details?.accessLevels;
        if (access.isPublic || userAccessLevels) {
            if (!userAccessLevels) {
                return true;
            }
            if (access.type === AccessCheckType.NONE) {
                // User does not have any of the access levels from the check
                return !access.levels.some((lvl) => user.details.accessLevels.includes(lvl));
            }
            if (access.type === AccessCheckType.ANY) {
                // User has at least one of the access levels from the check
                return access.levels.some((lvl) => user.details.accessLevels.includes(lvl));
            }
            if (access.type === AccessCheckType.ALL) {
                // User has all of the access levels from the check
                return !access.levels.some((lvl) => !user.details.accessLevels.includes(lvl));
            }
        }

        return false;
    }

    logout = (data: ILogoutCredentials) => axios({
        method: 'post',
        url: '/users-service/auth/logout',
        data,
    })

    sendFeedback = (feedback: string) => axios({
        method: 'post',
        url: '/users-service/subscribers/send-feedback',
        data: {
            feedback,
        },
    })
}

export default new UsersService();
