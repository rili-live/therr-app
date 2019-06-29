import { SocketClientActionTypes } from 'rili-public-library/utilities/constants';
import UserService from '../../services/UserService';

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
                const { idToken, userName } = response && response.data;
                    dispatch({
                        'type': SocketClientActionTypes.LOGIN,
                        'data': {
                            idToken,
                            userName,
                        },
                    });
            });
        };
    },
    register: (data: any) => {
        return (dispatch: any) => {
            return UserService.authenticate(data).then((response) => {
                const { idToken, userName } = response && response.data;
                    dispatch({
                        'type': SocketClientActionTypes.LOGIN,
                        'data': {
                            idToken,
                            userName,
                        },
                    });
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
