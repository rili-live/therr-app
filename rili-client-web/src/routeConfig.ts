export default [
    {
        route: '/',
        head: {
            title: 'Home',
        },
        view: 'index',
    },
    {
        route: '/chat-room',
        head: {
            title: 'Chat Room',
        },
        view: 'index',
    },
    {
        route: '/join-room',
        head: {
            title: 'Join Chat Room',
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
