/* eslint-disable max-len */
export default [
    {
        route: '/',
        head: {
            title: 'Home',
            description: 'Access your local business Dashboard',
        },
        view: 'index',
    },
    {
        route: '/dashboard',
        head: {
            title: 'Dashboard',
            description: 'Access your local business Dashboard',
        },
        view: 'index',
    },
    {
        route: '/login',
        head: {
            title: 'Login',
            description: 'Sign in to Therr for Business dashboard.',
        },
        view: 'index',
    },
    {
        route: '*',
        head: {
            title: 'Page Not Found',
            description: 'Access your local business Dashboard',
        },
        view: 'index',
    },
];
