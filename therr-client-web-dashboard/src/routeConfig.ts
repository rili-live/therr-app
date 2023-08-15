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
        route: '/register',
        head: {
            title: 'Register',
            description: 'Register your Therr for Business account.',
        },
        view: 'index',
    },
    {
        route: '/settings',
        head: {
            title: 'Settings',
            description: 'Updated your dashboard account settings.',
        },
        view: 'index',
    },
    {
        route: '/reset-password',
        head: {
            title: 'Reset Your Password',
            description: 'Forgot your password? Reset it here.',
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
