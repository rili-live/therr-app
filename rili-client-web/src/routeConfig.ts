export default [
    {
        route: '/',
        head: {
            title: 'Home',
        },
        view: 'index',
    },
    {
        route: '/forums',
        head: {
            title: 'Forums',
        },
        view: 'index',
    },
    {
        route: '/create-forum',
        head: {
            title: 'Join Forum',
        },
        view: 'index',
    },
    {
        route: '/login',
        head: {
            title: 'Login',
        },
        view: 'index',
    },
    {
        route: '*',
        head: {
            title: 'Not Found',
        },
        view: 'index',
    },
];
