import ChatRoom from './ChatRoom';
import JoinRoom from './JoinRoom';
import PageNotFound from './PageNotFound';
import Register from './Register';
import { RouteProps } from 'react-router-dom';
import Home from './Home';
import Login from './Login';

export enum AccessCheckType {
    ALL = 'all', // User has all of the access levels from the check
    ANY = 'any', // User has at least one of the access levels from the check
    NONE = 'none', // User does not have any of the access levels from the check
}

export interface IAccess {
    type: AccessCheckType;
    levels: Array<String>;
}

export interface IRoute extends RouteProps {
    access?: any;
    exact?: boolean;
    fetchData?: Function;
    // Overriding this property allows us to add custom paramaters to React components
    component: any;
}

let routes: IRoute[] = [
    {
        path: '/',
        component: Home,
        exact: true,
    },
    {
        path: '/chat-room/:roomId',
        component: ChatRoom,
        exact: true,
        access: {
            type: AccessCheckType.ALL,
            levels: ['user.default'],
        },
    },
    {
        path: '/join-room',
        component: JoinRoom,
        exact: true,
        access: {
            type: AccessCheckType.ALL,
            levels: ['user.default'],
        },
    },
    {
        path: '/login',
        component: Login,
        exact: true,
    },
    {
        path: '/register',
        component: Register,
        exact: true,
    },

    // If no route matches, return NotFound component
    {
        'component': PageNotFound,
    },
];

export default routes;