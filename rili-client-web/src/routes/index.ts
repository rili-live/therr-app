import { RouteProps } from 'react-router-dom';
import { AccessCheckType } from '../types';
import Forum from './Forum';
import CreateForum from './CreateForum';
import PageNotFound from './PageNotFound';
import Register from './Register';
import Home from './Home';
import Login from './Login';
import UserProfile from './UserProfile';

export interface IRoute extends RouteProps {
    access?: any;
    exact?: boolean;
    fetchData?: Function;
    // Overriding this property allows us to add custom paramaters to React components
    component: any;
    redirectPath?: string;
}

const routes: IRoute[] = [
    {
        path: '/',
        component: Home,
        exact: true,
        redirectPath: '/',
    },
    {
        path: '/forums/:roomId',
        component: Forum,
        exact: true,
        access: {
            type: AccessCheckType.ALL,
            levels: ['user.default'],
        },
    },
    {
        path: '/create-forum',
        component: CreateForum,
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
    {
        path: '/user/profile',
        component: UserProfile,
        exact: true,
        access: {
            type: AccessCheckType.ALL,
            levels: ['user.default'],
        },
    },

    // If no route matches, return NotFound component
    {
        component: PageNotFound,
    },
];

export default routes;
