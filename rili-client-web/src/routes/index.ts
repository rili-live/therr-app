import ChatRoom from './chat-room';
import Home from './home';
import { RouteProps } from 'react-router-dom';
// import Login from './components/pages/Login';
// import NotFound from './components/pages/NotFound';
// import Register from './components/pages/Register';

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
        exact: true
    },
    {
        path: '/chat-room',
        component: ChatRoom,
        exact: true
    },
    // {
    // 	'path': '/login',
    // 	'component': Login,
    // 	'exact': true
    // },
    // {
    // 	'path': '/register',
    // 	'component': Register,
    // 	'exact': true
    // },

    // If no route matches, return NotFound component
    // {
    // 	'component': NotFound
    // }
];

export default routes;