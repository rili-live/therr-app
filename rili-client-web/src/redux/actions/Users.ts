import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import { IUser } from 'types/user';
import { socketIO } from '../../socket-io-middleware';
import UsersService from '../../services/UsersService';

const Socket = {
    login: (data: any) => async (dispatch: any) => {
        await UsersService.authenticate(data).then((response) => {
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
            const userData: IUser = Immutable.from({
                accessLevels,
                id,
                idToken,
                email,
                firstName,
                lastName,
                phoneNumber,
                userName,
            });
            sessionStorage.setItem('riliSession', JSON.stringify({ id: socketIO.id }));
            sessionStorage.setItem('riliUser', JSON.stringify(userData));
            if (data.rememberMe) {
                localStorage.setItem('riliSession', JSON.stringify({ id: socketIO.id }));
                localStorage.setItem('riliUser', JSON.stringify(userData));
            }
            socketIO.io.opts.query = {
                token: idToken,
            };
            socketIO.connect();
            dispatch({
                type: SocketClientActionTypes.LOGIN,
                data: userData,
            });
        });
    },
    logout: (data: any) => (dispatch: any) => UsersService.logout(data).then(() => {
        sessionStorage.removeItem('riliSession');
        sessionStorage.removeItem('riliUser');
        localStorage.removeItem('riliSession');
        localStorage.removeItem('riliUser');
        socketIO.disconnect();
        dispatch({
            type: SocketClientActionTypes.LOGOUT,
            data: {
                userName: data.userName,
            },
        });
    }),
    register: (data: any) => (dispatch: any) => UsersService.create(data).then((response) => {
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
};

export default Socket;
