import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IUser } from '../../types/redux/user';
import UsersService from '../../services/UsersService';

class UsersActions {
    constructor(socketIO, NativeStorage?) {
        this.socketIO = socketIO;
        this.NativeStorage = NativeStorage;
    }

    private socketIO;

    private NativeStorage;

    login = (data: any) => async (dispatch: any) => {
        await UsersService.authenticate(data).then(async (response) => {
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
                // NOTE: Native Storage methods return a promise, but in this case we don't need to await
                (this.NativeStorage || sessionStorage).setItem('riliSession', JSON.stringify({ id: this.socketIO.id }));
                if (data.rememberMe && !this.NativeStorage) {
                    localStorage.setItem('riliSession', JSON.stringify({ id: this.socketIO.id }));
                }
            });
            this.socketIO.connect();
            (this.NativeStorage || sessionStorage).setItem('riliUser', JSON.stringify(userData));
            if (data.rememberMe && !this.NativeStorage) {
                localStorage.setItem('riliUser', JSON.stringify(userData));
            }
            dispatch({
                type: SocketClientActionTypes.LOGIN,
                data: userData,
            });
        });
    };

    logout = (userDetails?: any) => (dispatch: any) => UsersService.logout(userDetails).then(() => {
        // NOTE: Native Storage methods return a promise, but in this case we don't need to await
        (this.NativeStorage || sessionStorage).removeItem('riliSession');
        (this.NativeStorage || sessionStorage).removeItem('riliUser');
        if (!this.NativeStorage) {
            localStorage.removeItem('riliSession');
            localStorage.removeItem('riliUser');
        }
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

export default UsersActions;
