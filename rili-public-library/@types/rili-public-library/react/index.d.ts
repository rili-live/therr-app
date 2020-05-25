declare module 'rili-public-library/react/actions' {
    const NotificationActions: {
        search: (query: any) => (dispatch: any) => Promise<void>;
        update: (data: any) => (dispatch: any) => void;
    }

    const SocketActions: {
        refreshConnection: (data: any) => (dispatch: any) => void;
        joinForum: (data: any) => (dispatch: any) => void;
        leaveForum: (data: any) => (dispatch: any) => void;
        sendMessage: (data: any) => (dispatch: any) => void;
        sendDirectMessage: (data: any) => (dispatch: any) => void;
    }

    const UserConnectionsActions: {
        search: (query: any, userId: number) => (dispatch: any) => Promise<void>;
        create: (data: any) => (dispatch: any) => void;
        update: (data: any) => (dispatch: any) => void;
    }

    class UsersActions {
        constructor(socketIO: any);
        private socketIO;
        login: (data: any) => (dispatch: any) => Promise<void>;
        logout: (userDetails?: any) => (dispatch: any) => Promise<void>;
        register: (data: any) => (dispatch: any) => Promise<{
            email: any;
            id: any;
            userName: any;
        }>;
    }

    export {
        NotificationActions,
        SocketActions,
        UserConnectionsActions,
        UsersActions,
    }
}

declare module 'rili-public-library/react/reducers' {
    const getCombinedReducers: Function;

    export default getCombinedReducers;
}

declare module 'rili-public-library/react/UsersService' {
    class UsersService {
        authenticate: (data: any) => import("axios").AxiosPromise<any>;
        create: (data: any) => import("axios").AxiosPromise<any>;
        isAuthorized: (access: any, user: any) => boolean;
        logout: (data: any) => import("axios").AxiosPromise<any>;
    }

    const _default: UsersService;
    export default _default;
}