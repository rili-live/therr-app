import { SocketClientActionTypes } from 'rili-public-library/utilities/constants';
import UserService from '../../services/UserService';
import { IUser } from 'types/user';

const SocketActions = {
    joinRoom: (data: any) => {
        return (dispatch: any) => {
            dispatch({
                'type': SocketClientActionTypes.JOIN_ROOM,
                'data': data,
            });
        };
    },
    login: (data: any) => {
        return (dispatch: any) => {
            return UserService.authenticate(data).then((response) => {
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
                    'type': SocketClientActionTypes.LOGIN,
                    'data': userData,
                });
            });
        };
    },
    logout: (data: any) => {
        return (dispatch: any) => {
            return UserService.logout(data).then(() => {
                sessionStorage.removeItem('riliUser');
                localStorage.removeItem('riliUser');
                dispatch({
                    'type': SocketClientActionTypes.LOGOUT,
                    'data': {
                        userName: data.userName,
                    },
                });
            });
        };
    },
    register: (data: any) => {
        return (dispatch: any) => {
            return UserService.create(data).then((response) => {
                const { accessLevels, email, id, userName } = response && response.data;
                    // TODO: Determine if it is necessary to dispatch anything after user registers
                    // set current user? 
                    dispatch({
                        'type': SocketClientActionTypes.REGISTER,
                        'data': {
                            accessLevels,
                            email,
                            id,
                            userName,
                        },
                    });
                    return { email, id, userName };
            });
        };
    },
    sendMessage: (data: any) => {
        return (dispatch: any) => {
            dispatch({
                'type': SocketClientActionTypes.SEND_MESSAGE,
                'data': data,
            });
        };
    },
};

export default SocketActions;
