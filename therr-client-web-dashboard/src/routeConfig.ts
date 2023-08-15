/* eslint-disable max-len */
export default [
    {
        route: '/',
        head: {
            title: 'Home',
            description: 'Access your local business dashboard for single origin marketing',
        },
        view: 'index',
    },
    {
        route: '/dashboard',
        head: {
            title: 'Dashboard',
            description: 'Your local business dashboard',
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
            description: 'Oops! This page is nowhere to be found.',
        },
        view: 'index',
    },
];
