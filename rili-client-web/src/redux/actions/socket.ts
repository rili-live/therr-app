import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import { IUser } from 'types/user';
import UserService from '../../services/UserService';

const SocketActions = {
    joinRoom: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.JOIN_ROOM,
            data,
        });
    },
    login: (data: any) => (dispatch: any) => UserService.authenticate(data).then((response) => {
        const {
            accessLevels,
            id,
            idToken,
            email,
            firstName,
            lastName,
            phoneNumber,
            userName,
        } = response.data;
        const userData: IUser = {
            accessLevels,
            id,
            idToken,
            email,
            firstName,
            lastName,
            phoneNumber,
            userName,
        };
        sessionStorage.setItem('riliUser', JSON.stringify(userData));
        if (data.rememberMe) {
            localStorage.setItem('riliUser', JSON.stringify(userData));
        }
        dispatch({
            type: SocketClientActionTypes.LOGIN,
            data: userData,
        });
    }),
    logout: (data: any) => (dispatch: any) => UserService.logout(data).then(() => {
        sessionStorage.removeItem('riliUser');
        localStorage.removeItem('riliUser');
        dispatch({
            type: SocketClientActionTypes.LOGOUT,
            data: {
                userName: data.userName,
            },
        });
    }),
    register: (data: any) => (dispatch: any) => UserService.create(data).then((response) => {
        const {
            accessLevels, email, id, userName,
        } = response && response.data;
        // TODO: Determine if it is necessary to dispatch anything after user registers
        // set current user?
        dispatch({
            type: SocketClientActionTypes.REGISTER,
            data: {
                accessLevels,
                email,
                id,
                userName,
            },
        });
        return { email, id, userName };
    }),
    sendMessage: (data: any) => (dispatch: any) => {
        dispatch({
            type: SocketClientActionTypes.SEND_MESSAGE,
            data,
        });
    },
};

export default SocketActions;
