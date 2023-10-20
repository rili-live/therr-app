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
        route: '/influencer-pairings',
        head: {
            title: 'Dashboard',
            description: 'Your personalized selection of local influencers who would be perfect pairing for your business',
        },
        view: 'index',
    },
    {
        route: '/login',
        head: {
            title: 'Login',
            // Note: These brand specific descriptions are dynamically updated in the server side rendering client
            description: 'Sign in to Therr for Business dashboard.',
        },
        view: 'index',
    },
    {
        route: '/register',
        head: {
            title: 'Register',
            // Note: These brand specific descriptions are dynamically updated in the server side rendering client
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
