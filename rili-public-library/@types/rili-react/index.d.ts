// FORMS //

declare interface IBaseButtonProps {
    id?: string;
    children?: any;
    className?: string;
    disabled?: boolean;
    onClick: any;
    text?: string;
}

declare class BaseButton extends React.Component<IBaseButtonProps> {
    static propTypes: any;
    static defaultProps: {
        disabled: boolean;
    };
    render(): JSX.Element;
}

interface ISvgButtonProps extends IBaseButtonProps {
    className: string;
    iconClassName?: string;
    name: string;
    buttonType?: string;
}

interface IInlineSvgProps {
    className: string;
    name: string;
}

declare module 'rili-react/BaseButton' {
    export default BaseButton;
}

declare module 'rili-react/ButtonPrimary' {
    class ButtonPrimary extends BaseButton {
        static defaultProps: {
            className: string;
            disabled: boolean;
        };
    }
    export default ButtonPrimary;
}

declare module 'rili-react/ButtonSecondary' {
    class ButtonSecondary extends BaseButton {
        static defaultProps: {
            className: string;
            disabled: boolean;
        };
    }
    export default ButtonSecondary;
}

declare module 'rili-react/RadioGroup' {
    import PropTypes from 'prop-types';
    class RadioGroup extends React.Component<any, any> {
        static propTypes: {
            name: PropTypes.Validator<string>;
            onSelect: PropTypes.Validator<(...args: any[]) => any>;
            options: PropTypes.Validator<PropTypes.InferProps<{
                value: PropTypes.Validator<string | number | boolean>;
                text: PropTypes.Validator<string>;
            }>[]>;
            value: PropTypes.Validator<string | number | boolean>;
        };
        selectOption: (event: any) => void;
        render(): JSX.Element;
    }
    export default RadioGroup;
}

declare module 'rili-react/SearchBox' {
    class SearchBox extends React.Component<any, any> {
        static getDerivedStateFromProps(nextProps: any, nextState: any): {
            inputValue: any;
        } | {
            inputValue?: undefined;
        };
        static propTypes: any;
        static defaultProps: any;
        constructor(props: any);
        handleInputChange: (key: any, value: any) => void;
        handleSearch: (event: any) => void;
        onBlur: () => void;
        onFocus: () => void;
        render(): JSX.Element;
    }
    export default SearchBox;
}

declare module 'rili-react/SelectBox' {
    class SelectBox extends React.Component<any, any> {
        static getDerivedStateFromProps(nextProps: any, nextState: any): {};
        static updateValidations: (props: any) => {
            isInvalid: boolean;
        };
        static propTypes: any;
        static defaultProps: any;
        constructor(props: any);
        componentDidMount(): void;
        componentWillUnmount(): void;
        private buttonElement;
        handleArrowKey: (change: any) => void;
        handleKeyDown: (event: any) => void;
        handlePageClick: (event: any) => void;
        handleSelectionChange: (event: any) => void;
        onFocus: () => void;
        toggleSelectionVisibility: () => void;
        updateValidations: (props: any) => void;
        render(): JSX.Element;
    }
    export default SelectBox;
}

declare module 'rili-react/SvgButton' {
    class SvgButton extends React.Component<ISvgButtonProps & IInlineSvgProps> {
        static defaultProps: {
            className: string;
            disabled: boolean;
        };
        render(): JSX.Element;
    }
    export default SvgButton;
}

// ROUTING
// declare module 'rili-react/AuthRoute' {
//     import { RouteComponentProps } from 'react-router-dom';
//     interface IAuthRouteProps extends RouteComponentProps<{}> {
//         access: any;
//         component: any;
//         exact: boolean;
//         isAuthorized: boolean;
//         redirectPath: string;
//         path: any;
//     }
//     class AuthRoute extends React.Component<IAuthRouteProps, any> {
//         constructor(props: IAuthRouteProps);
//         redirectPath: string;
//         render(): JSX.Element;
//     }
//     const _default: React.ComponentClass<Pick<Pick<IAuthRouteProps, "isAuthorized" | "path" | "access" | "component" | "exact" | "redirectPath" | "history" | "location" | "match" | "staticContext">, "isAuthorized" | "path" | "access" | "component" | "exact" | "redirectPath">, any> & import("react-router").WithRouterStatics<import("react-redux").ConnectedComponent<typeof AuthRoute, Pick<IAuthRouteProps, "isAuthorized" | "path" | "access" | "component" | "exact" | "redirectPath" | "history" | "location" | "match" | "staticContext">>>;
//     export default _default;
// }

// declare module 'rili-react/RedirectWithStatus' {
//     import { RedirectProps } from 'react-router-dom';
//     interface IRedirectWithStatusProps extends RedirectProps {
//         statusCode: string | number;
//     }
//     class RedirectWithStatus extends React.Component<IRedirectWithStatusProps, any> {
//         render(): JSX.Element;
//     }
//     export default RedirectWithStatus;
// }

declare module 'rili-react/Status' {
    interface IStatusProps {
        statusCode: any;
    }
    class Status extends React.Component<IStatusProps, any> {
        render(): JSX.Element;
    }
    export default Status;
}

// MISCELLANEOUS //
declare module 'rili-react/AccessControl' {
    interface IAccessControlProps {
        isAuthorized: boolean;
        publicOnly?: boolean;
    }
    const AccessControl: React.SFC<IAccessControlProps>;
    export default AccessControl;
}

// REDUX ACTIONS //
declare module 'rili-react/actions' {
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

// REDUX REDUCERS //
declare module 'rili-react/reducers' {
    const _default: (socketIO: any) => import("redux").Reducer<import("redux").CombinedState<{
        routing: import("react-router-redux").RouterState;
        socket: any;
        notifications: any;
        user: any;
        userConnections: any;
    }>, import("redux").AnyAction>;
    export default _default;
}

// SERVICES //
// declare module 'rili-react/NotificationsService' {
//     class NotificationsService {
//         search: (query: ISearchQuery) => import("axios").AxiosPromise<any>;
//     }
//     const _default: NotificationsService;
//     export default _default;
// }

// declare module 'rili-react/UserConnectionsService' {
//     interface ICreateConnectionBody {
//         requestingUserId: number;
//         acceptingUserEmail?: string;
//         acceptingUserPhoneNumber?: string;
//     }
//     class UserConnectionsService {
//         create: (data: ICreateConnectionBody) => import("axios").AxiosPromise<any>;
//         update: (requestingUserId: import("react").ReactText, data: ICreateConnectionBody) => import("axios").AxiosPromise<any>;
//         search: (query: ISearchQuery) => import("axios").AxiosPromise<any>;
//     }
//     const _default: UserConnectionsService;
//     export default _default;
// }

declare module 'rili-react/UsersService' {
    class UsersService {
        authenticate: (data: any) => import("axios").AxiosPromise<any>;
        create: (data: any) => import("axios").AxiosPromise<any>;
        isAuthorized: (access: any, user: any) => boolean;
        logout: (data: any) => import("axios").AxiosPromise<any>;
    }

    const _default: UsersService;
    export default _default;
}