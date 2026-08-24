/**
 * @jest-environment jsdom
 */
/* eslint-disable react/display-name, import/first, import/order, import/newline-after-import, @typescript-eslint/no-var-requires */

jest.mock('therr-react/redux/actions', () => ({
    UserConnectionsActions: {
        search: jest.fn(),
    },
}));

jest.mock('therr-react/services', () => ({
    MapsService: {
        searchSpaces: jest.fn().mockResolvedValue({ data: { results: [] } }),
    },
    UsersService: {
        searchThoughts: jest.fn().mockResolvedValue({ data: { results: [] } }),
    },
}));

jest.mock('therr-react/types', () => ({}));

jest.mock('therr-js-utilities/constants', () => ({
    BrandVariations: {
        THERR: 'therr',
        HABITS: 'habits',
        TEEM: 'teem',
    },
}));

jest.mock('../../redux/actions/UsersActions', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        getByUserName: jest.fn(),
    },
}));

jest.mock('../../utilities/getUserImageUri', () => ({
    __esModule: true,
    default: () => 'https://example.com/image.jpg',
}));

jest.mock('../../components/business-profile/BusinessSpaceCard', () => () => null);
jest.mock('../../components/business-profile/BusinessEventCard', () => () => null);
jest.mock('../../components/business-profile/ThoughtCard', () => () => null);

jest.mock('../../wrappers/withNavigation', () => (c: any) => c);
jest.mock('../../wrappers/withTranslation', () => (c: any) => c);

jest.mock('@mantine/core', () => {
    const React = require('react'); // eslint-disable-line global-require
    const stub = (name: string) => (props: any) => React.createElement('div', { 'data-testid': name, ...props }, props.children);
    return {
        Anchor: stub('Anchor'),
        Avatar: stub('Avatar'),
        Box: stub('Box'),
        Breadcrumbs: stub('Breadcrumbs'),
        Button: stub('Button'),
        Container: stub('Container'),
        Divider: stub('Divider'),
        Group: stub('Group'),
        SimpleGrid: stub('SimpleGrid'),
        Skeleton: stub('Skeleton'),
        Stack: stub('Stack'),
        Text: stub('Text'),
        Title: stub('Title'),
    };
});

import { ViewUserComponent } from '../ViewUser';

describe('ViewUser connection status', () => {
    const VIEWER_ID = 'viewer-id';
    const TARGET_ID = 'target-id';

    const buildInstance = (overrides: Record<string, any> = {}) => {
        const props = {
            navigation: { navigate: jest.fn() },
            routeParams: { userId: TARGET_ID },
            user: {
                isAuthenticated: true,
                details: { id: VIEWER_ID },
                userInView: { id: TARGET_ID },
            },
            userConnections: { connections: [], activeConnections: [] },
            getUser: jest.fn().mockResolvedValue({ id: TARGET_ID }),
            getUserByUserName: jest.fn().mockResolvedValue({ id: TARGET_ID }),
            searchUserConnections: jest.fn().mockResolvedValue(undefined),
            locale: 'en-us',
            translate: (key: string) => key,
            ...overrides,
        };

        const instance = new ViewUserComponent(props as any);
        (instance as any).props = props;
        return instance;
    };

    // A connection list entry as searchUserConnections returns it: `users` holds only
    // the *other* party, because the SQL join excludes the requesting user.
    const cachedConnectionTo = (otherUserId: string) => ({
        id: 'connection-id',
        users: [{ id: otherUserId, userName: 'someone' }],
    });

    describe('isConnectedToUserInView', () => {
        it('trusts the server flag over an empty cached connections list', () => {
            // The regression: this profile is a real connection, but the viewer's cached
            // list is empty (never fetched, or capped at its single 50-item page), so the
            // old list-only check rendered them as not connected.
            const instance = buildInstance();

            expect(instance.isConnectedToUserInView({ id: TARGET_ID, isNotConnected: false })).toBe(true);
        });

        it('trusts the server flag over a cached list left behind by another account', () => {
            // Previous account's connections rehydrated from redux-persist. The stale entry
            // must not make an unconnected profile look connected.
            const instance = buildInstance({
                userConnections: { connections: [cachedConnectionTo(TARGET_ID)], activeConnections: [] },
            });

            expect(instance.isConnectedToUserInView({ id: TARGET_ID, isNotConnected: true })).toBe(false);
        });

        it('reports not connected when the server says so', () => {
            const instance = buildInstance();

            expect(instance.isConnectedToUserInView({ id: TARGET_ID, isNotConnected: true })).toBe(false);
        });

        it('falls back to the cached list when the response carries no flag', () => {
            const instance = buildInstance({
                userConnections: { connections: [cachedConnectionTo(TARGET_ID)], activeConnections: [] },
            });

            expect(instance.isConnectedToUserInView({ id: TARGET_ID })).toBe(true);
        });

        it('falls back to not connected when there is neither a flag nor a cached entry', () => {
            const instance = buildInstance();

            expect(instance.isConnectedToUserInView({ id: TARGET_ID })).toBe(false);
        });
    });

    describe('handleChatClick', () => {
        it('messages the profile in view rather than a cached list entry', () => {
            const onInitMessaging = jest.fn();
            const userInView = { id: TARGET_ID, userName: 'targetuser' };
            const instance = buildInstance({
                onInitMessaging,
                user: {
                    isAuthenticated: true,
                    details: { id: VIEWER_ID },
                    userInView,
                },
            });

            instance.handleChatClick({ stopPropagation: jest.fn() });

            expect(onInitMessaging).toHaveBeenCalledWith(expect.anything(), userInView, 'view-user');
        });

        it('redirects unauthenticated visitors to login', () => {
            const onInitMessaging = jest.fn();
            const instance = buildInstance({
                onInitMessaging,
                user: { isAuthenticated: false, details: {}, userInView: { id: TARGET_ID } },
            });

            instance.handleChatClick({ stopPropagation: jest.fn() });

            expect(onInitMessaging).not.toHaveBeenCalled();
            expect((instance as any).props.navigation.navigate).toHaveBeenCalledWith('/login');
        });
    });
});
