/* eslint-disable max-len */
export default [
    {
        route: '/',
        head: {
            title: 'Home',
            description: 'A nearby newsfeed app & social network that allows connections through the space around us. Users and local businesses creating authentic connections.',
        },
        view: 'index',
    },
    {
        route: '/forums',
        head: {
            title: 'Forums',
            description: 'A nearby newsfeed app & social network that allows connections through the space around us. Users and local businesses creating authentic connections.',
        },
        view: 'index',
    },
    {
        route: '/create-forum',
        head: {
            title: 'Join Forum',
            description: 'A nearby newsfeed app & social network that allows connections through the space around us. Users and local businesses creating authentic connections.',
        },
        view: 'index',
    },
    {
        route: '/login',
        head: {
            title: 'Login',
            description: 'Sign in to Therr and see what new events are popping up in the local community.',
        },
        view: 'index',
    },
    {
        route: '/user/profile',
        head: {
            title: 'Profile',
            description: 'Your user profile page',
        },
        view: 'index',
    },
    {
        route: '*',
        head: {
            title: 'Not Found',
            description: 'Navigate social media with movement and earn rewards for upvotes & interactions.',
        },
        view: 'index',
    },
    {
        route: '/go-mobile',
        head: {
            title: 'Go Mobile',
            description: 'For the best experience, download the mobile version of Therr app',
        },
        view: 'index',
    },
];
