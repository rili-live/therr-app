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
                (this.NativeStorage || sessionStorage).setItem('therrSession', JSON.stringify({ id: this.socketIO.id }));
                if (data.rememberMe && !this.NativeStorage) {
                    localStorage.setItem('therrSession', JSON.stringify({ id: this.socketIO.id }));
                }

                dispatch({
                    type: SocketClientActionTypes.LOGIN,
                    data: userData,
                });
            });
            this.socketIO.connect();
            (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify(userData));
            if (data.rememberMe && !this.NativeStorage) {
                localStorage.setItem('therrUser', JSON.stringify(userData));
            }
        });
    };

    logout = (userDetails?: any) => async (dispatch: any) => {
        // NOTE: Native Storage methods return a promise, but in this case we don't need to await
        userDetails = userDetails // eslint-disable-line no-param-reassign
            || JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || null);
        let user;
        try {
            user = await ((userDetails ? UsersService.logout(userDetails) : Promise.resolve()) as Promise<any>);
        } catch (err) {
            console.log(err);
        }
        if (!this.NativeStorage) {
            localStorage.removeItem('therrSession');
            localStorage.removeItem('therrUser');
            sessionStorage.removeItem('therrSession');
            sessionStorage.removeItem('therrUser');
        } else {
            this.NativeStorage.multiRemove(['therrSession', 'therrUser']);
        }
        dispatch({
            type: SocketClientActionTypes.LOGOUT,
            data: {
                id: user && user.id,
                idToken: user && user.idToken,
                userName: user && user.userName,
            },
        });
        // NOTE: Socket will disconnect in reducer after event response from server (SESSION_CLOSED)
    }

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

    update = (id: string, data: any) => (dispatch: any) => UsersService.update(id, data).then(async (response) => {
        const {
            email,
            firstName,
            lastName,
            userName,
        } = response && response.data;
        // TODO: Determine if it is necessary to dispatch anything after user registers
        // set current user?
        const userDetails = JSON.parse(await (this.NativeStorage || sessionStorage).getItem('therrUser') || {});
        const userData: IUser = Immutable.from({
            ...userDetails,
            ...response.data,
        });
        (this.NativeStorage || sessionStorage).setItem('therrUser', JSON.stringify(userData));

        dispatch({
            type: SocketClientActionTypes.UPDATE_USER,
            data: {
                email,
                id,
                firstName,
                lastName,
                userName,
            },
        });
        return { email, id, userName };
    });
}

export default UsersActions;
