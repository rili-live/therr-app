/* eslint-disable max-len */
export default [
    {
        route: '/',
        head: {
            title: 'Create your Social Profile or Business',
            description: 'Discover local businesses, restaurants, events, and connect with your community. Create your free profile on Therr.',
        },
        view: 'index',
    },
    {
        route: '/groups',
        head: {
            title: 'Groups',
            description: 'Join groups on Therr App to connect with your community. Chat, share events, and meet new people.',
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
        route: '/user/edit-profile',
        head: {
            title: 'Edit Profile',
            description: 'Edit your profile settings',
        },
        view: 'index',
    },
    {
        route: '/spaces/manage',
        head: {
            title: 'Manage Locations',
            description: 'Manage your business locations on Therr.',
        },
        view: 'index',
    },
    {
        route: '/spaces/new',
        head: {
            title: 'Create Location',
            description: 'Create a new business location on Therr.',
        },
        view: 'index',
    },
    {
        route: '/spaces/:spaceId/edit',
        head: {
            title: 'Edit Location',
            description: 'Edit your business location details on Therr.',
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
            description: 'Browse local businesses, restaurants, bars, shops, and events near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/app-feedback',
        head: {
            title: 'App Feedback',
            description: 'Your voice matters!',
        },
        view: 'index',
    },
    {
        route: '/child-safety',
        head: {
            title: 'Child Safety Standards',
            description: 'Therr\'s child safety standards, prevention practices, and reporting procedures for child sexual abuse and exploitation (CSAE).',
        },
        view: 'index',
    },
    {
        route: '/invite/:username',
        head: {
            title: 'Join Therr App',
            description: 'Join the local community & rewards app. Sign up with an invite and you both earn rewards!',
        },
        view: 'invite',
    },
    {
        route: '/delete-account',
        head: {
            title: 'Delete Your Account',
            description: 'Request deletion of your Therr account and all associated data.',
        },
        view: 'index',
    },
    {
        route: '/locations/:pageNumber',
        head: {
            title: 'Business Locations',
            description: 'Browse local businesses, restaurants, bars, shops, and events near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/groups/:groupId',
        head: {
            title: 'Group not Found',
            description: 'Discover and join community groups on Therr App. Connect with people, chat, and attend local events together.',
        },
        view: 'groups',
    },
    {
        route: '/events/:eventId',
        head: {
            title: 'Event not Found',
            description: 'No event was found for the given ID.',
        },
        view: 'events',
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
        route: '/reset-password',
        head: {
            title: 'Reset Password',
            description: 'Reset your Therr account password. Enter your email to receive a password reset link.',
        },
        view: 'index',
    },
    {
        route: '/verify-account',
        head: {
            title: 'Account Verification',
            description: 'Verify your Therr account email address to complete registration.',
        },
        view: 'index',
    },
    {
        route: '/emails/unsubscribe',
        head: {
            title: 'E-mail Subscription Preferences',
            description: 'Manage your Therr email subscription preferences and notification settings.',
        },
        view: 'index',
    },
    {
        route: '/go-mobile',
        head: {
            title: 'Your Hub',
            description: 'Explore local people, places, and moments on Therr. Download the mobile app for the full experience.',
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
];
