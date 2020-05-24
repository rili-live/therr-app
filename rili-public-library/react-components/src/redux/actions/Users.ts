import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'rili-public-library/utilities/constants.js';
import { IUser } from '../types/user';
import UsersService from '../../services/UsersService';

class UserActions {
    constructor(socketIO) {
        this.socketIO = socketIO;
    }

    private socketIO;

    login = (data: any) => async (dispatch: any) => {
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
            this.socketIO.io.opts.query = {
                token: idToken,
            };
            // Connect and get socketIO.id
            this.socketIO.on('connect', () => {
                sessionStorage.setItem('riliSession', JSON.stringify({ id: this.socketIO.id }));
                if (data.rememberMe) {
                    localStorage.setItem('riliSession', JSON.stringify({ id: this.socketIO.id }));
                }
            });
            this.socketIO.connect();
            sessionStorage.setItem('riliUser', JSON.stringify(userData));
            if (data.rememberMe) {
                localStorage.setItem('riliUser', JSON.stringify(userData));
            }
            dispatch({
                type: SocketClientActionTypes.LOGIN,
                data: userData,
            });
        });
    };

    logout = (userDetails?: any) => (dispatch: any) => UsersService.logout(userDetails).then(() => {
        sessionStorage.removeItem('riliSession');
        sessionStorage.removeItem('riliUser');
        localStorage.removeItem('riliSession');
        localStorage.removeItem('riliUser');
        dispatch({
            type: SocketClientActionTypes.LOGOUT,
            data: {
                id: userDetails && userDetails.id,
                idToken: userDetails && userDetails.idToken,
                userName: userDetails && userDetails.userName,
            },
        });
        // NOTE: Socket will disconnect in reducer after event response from server (SESSION_CLOSED)
    });

    register = (data: any) => (dispatch: any) => UsersService.create(data).then((response) => {
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
    });
}

export default UserActions;
