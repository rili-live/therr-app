/* eslint-disable max-len */
export default [
    {
        route: '/',
        head: {
            title: 'Create your Social Profile or Business',
            description: 'Discover local businesses, earn rewards for check-ins, and connect with your community. Create your free profile on Therr.',
        },
        view: 'index',
    },
    {
        route: '/groups',
        head: {
            title: 'Groups',
            description: 'Join groups on Therr to connect with your community. Chat, plan events, and meet people who share your interests.',
        },
        view: 'index',
    },
    {
        route: '/create-forum',
        head: {
            title: 'Join Forum',
            description: 'Start or join a conversation on Therr. Connect with your local community through group chats and discussions.',
        },
        view: 'index',
    },
    {
        route: '/login',
        head: {
            title: 'Sign In',
            description: 'Sign in to Therr and start discovering local businesses, connecting with friends, and earning rewards in your community.',
        },
        view: 'index',
    },
    {
        route: '/register',
        head: {
            title: 'Register',
            description: 'Create your free Therr profile and start discovering local businesses, earning rewards, and connecting with your community.',
        },
        view: 'index',
    },
    {
        route: '/user/profile',
        head: {
            title: 'Profile',
            description: 'Manage your Therr profile, connections, and local business listings.',
        },
        view: 'index',
    },
    {
        route: '/user/edit-profile',
        head: {
            title: 'Edit Profile',
            description: 'Update your profile information and preferences on Therr.',
        },
        view: 'index',
    },
    {
        route: '/spaces/manage',
        head: {
            title: 'Manage Locations',
            description: 'Manage your business locations and listings on Therr.',
        },
        view: 'index',
    },
    {
        route: '/spaces/new',
        head: {
            title: 'Create Location',
            description: 'Add your business to Therr and start reaching nearby customers.',
        },
        view: 'index',
    },
    {
        route: '/spaces/:spaceId/edit',
        head: {
            title: 'Edit Location',
            description: 'Update your business listing details on Therr.',
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
        route: '/thoughts/:thoughtId',
        head: {
            title: 'Post not Found',
            description: 'No post was found for the given ID.',
        },
        view: 'thoughts',
    },
    {
        route: '/locations',
        head: {
            title: 'Local Business Directory',
            description: 'Browse local businesses, restaurants, bars, fitness studios, and events near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/app-feedback',
        head: {
            title: 'Share Your Feedback',
            description: 'Help us build the best local community app. Share your feedback and ideas with the Therr team.',
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
            description: 'Join the local community and rewards app. Sign up with an invite code and you both earn coins!',
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
            title: 'Local Business Directory',
            description: 'Browse local businesses, restaurants, bars, fitness studios, and events near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/locations/city/:citySlug',
        head: {
            title: 'Local Business Directory',
            description: 'Browse local businesses near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/locations/city/:citySlug/:pageNumber',
        head: {
            title: 'Local Business Directory',
            description: 'Browse local businesses near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/locations/city/:citySlug/:categorySlug',
        head: {
            title: 'Local Business Directory',
            description: 'Browse local businesses near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/locations/city/:citySlug/:categorySlug/:pageNumber',
        head: {
            title: 'Local Business Directory',
            description: 'Browse local businesses near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/locations/:categorySlug',
        head: {
            title: 'Local Business Directory',
            description: 'Browse local businesses near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/locations/:categorySlug/:pageNumber',
        head: {
            title: 'Local Business Directory',
            description: 'Browse local businesses near you. Read reviews, see hours, and get directions.',
        },
        view: 'locations',
    },
    {
        route: '/groups/:groupId',
        head: {
            title: 'Group not Found',
            description: 'Discover and join community groups on Therr. Connect with people, chat, and attend local events together.',
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
        route: '/spaces/:spaceId/:spaceSlug',
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
            title: 'Email Preferences',
            description: 'Manage your Therr email preferences and notification settings.',
        },
        view: 'index',
    },
    {
        route: '/bookmarks',
        head: {
            title: 'My Bookmarks',
            description: 'View your saved bookmarks on Therr. Revisit your favorite moments, spaces, and thoughts.',
        },
        view: 'index',
    },
    {
        route: '/go-mobile',
        head: {
            title: 'Your Local Hub',
            description: 'Discover local people, places, and deals on Therr. Download the mobile app for check-in rewards and real-time discovery.',
        },
        view: 'index',
    },
    {
        route: '*',
        head: {
            title: 'Not Found',
            description: 'Discover local businesses, earn rewards, and connect with your community on Therr.',
        },
        view: 'index',
    },
];
