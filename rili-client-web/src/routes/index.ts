import ChatRoom from './ChatRoom';
import JoinRoom from './JoinRoom';
import PageNotFound from './PageNotFound';
import Register from './Register';
import { RouteProps } from 'react-router-dom';
import Home from './Home';
import Login from './Login';

export interface IRoute extends RouteProps {
    access?: any;
    exact?: boolean;
    fetchData?: Function;
    // Overriding this property allows us to add custom paramaters to React components
    component: any;
}

let routes: IRoute[] = [
    {
        'path': '/',
        'component': Home,
        'exact': true,
    },
    {
        path: '/chat-room/:roomId',
        component: ChatRoom,
        exact: true,
    },
    {
        path: '/join-room',
        component: JoinRoom,
        exact: true,
    },
    {
        'path': '/login',
        'component': Login,
        'exact': true,
    },
    {
        'path': '/register',
        'component': Register,
        'exact': true,
    },

    // If no route matches, return NotFound component
    {
        'component': PageNotFound,
    },
];

export default routes;