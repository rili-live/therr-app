/* eslint-disable max-len */
export default [
    {
        route: '/',
        head: {
            title: 'Create your Social Profile or Business',
            description: 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.',
        },
        view: 'index',
    },
    {
        route: '/forums',
        head: {
            title: 'Forums',
            description: 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.',
        },
        view: 'index',
    },
    {
        route: '/create-forum',
        head: {
            title: 'Join Forum',
            description: 'Therr App is local-first community app and social network that allows connections through the digital space around us. We help you grow authentic connections daily.',
        },
        view: 'index',
    },
    {
        route: '/login',
        head: {
            title: 'Sign In',
            description: 'Sign in to Therr app and start discovering food, friends, and events in the local community.',
        },
        view: 'index',
    },
    {
        route: '/register',
        head: {
            title: 'Register',
            description: 'Create your profile on Therr app and start discovering food, friends, and events in the local community.',
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
        route: '/moments/:momentId',
        head: {
            title: 'Moment not Found',
            description: 'No moment was found for the given ID.',
        },
        view: 'moments',
    },
    {
        route: '/locations',
        head: {
            title: 'Business Locations',
            description: 'Local business directory of business spaces on Therr App',
        },
        view: 'index',
    },
    {
        route: '/locations/:pageNumber',
        head: {
            title: 'Business Locations',
            description: 'Local business directory of business spaces on Therr App',
        },
        view: 'index',
    },
    {
        route: '/spaces/:spaceId',
        head: {
            title: 'Space not Found',
            description: 'No business space was found for the given ID.',
        },
        view: 'spaces',
    },
    {
        route: '/users/:userId',
        head: {
            title: 'User not Found',
            description: 'No user was found for the given ID.',
        },
        view: 'users',
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
