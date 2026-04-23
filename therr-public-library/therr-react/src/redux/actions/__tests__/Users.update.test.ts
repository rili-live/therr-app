jest.mock('therr-js-utilities/constants', () => ({
    SocketClientActionTypes: {
        UPDATE_USER: 'CLIENT:UPDATE_USER',
    },
}));

jest.mock('../../../services/UsersService', () => ({
    __esModule: true,
    default: {
        update: jest.fn(),
    },
}));

// eslint-disable-next-line import/first
import { SocketClientActionTypes } from 'therr-js-utilities/constants';

// eslint-disable-next-line import/first
import UsersService from '../../../services/UsersService';
// eslint-disable-next-line import/first
import UsersActions from '../Users';

const nativeStorage = {
    getItem: jest.fn().mockResolvedValue('{}'),
    setItem: jest.fn(),
};

const createActions = () => new (UsersActions as any)({}, nativeStorage);

const serverUser = {
    id: 'u1',
    email: 'u1@test.com',
    firstName: 'First',
    lastName: 'Last',
    userName: 'user1',
    phoneNumber: '+10000000000',
    media: {},
    accessLevels: [],
    blockedUsers: [],
    hasAgreedToTerms: true,
    isBusinessAccount: false,
    isCreatorAccount: false,
    isSuperUser: false,
    shouldHideMatureContent: false,
    settingsLocale: 'en-us',
    // Stale theme — simulates the server response reflecting pre-commit state of a concurrent
    // settings write (e.g. a theme change racing with this FCM-token update).
    settingsThemeName: 'light',
};

describe('UsersActions.update — Redux settings dispatch scoping', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (UsersService.update as jest.Mock).mockResolvedValue({ data: serverUser });
        nativeStorage.getItem.mockResolvedValue('{}');
    });

    it('does NOT dispatch settings when the request has no settings* keys', async () => {
        const dispatch = jest.fn();
        const actions = createActions();
        await actions.update('u1', { deviceMobileFirebaseToken: 'new-token' })(dispatch);

        const updateDispatch = dispatch.mock.calls.find(
            ([action]) => action?.type === SocketClientActionTypes.UPDATE_USER,
        );
        expect(updateDispatch).toBeDefined();
        expect(updateDispatch[0].data.details).toBeDefined();
        expect(updateDispatch[0].data.settings).toBeUndefined();
    });

    it('does NOT dispatch settings for hasAgreedToTerms-only updates', async () => {
        const dispatch = jest.fn();
        const actions = createActions();
        await actions.update('u1', { hasAgreedToTerms: true })(dispatch);

        const updateDispatch = dispatch.mock.calls.find(
            ([action]) => action?.type === SocketClientActionTypes.UPDATE_USER,
        );
        expect(updateDispatch[0].data.settings).toBeUndefined();
    });

    it('dispatches settings when the request includes a settingsThemeName change', async () => {
        (UsersService.update as jest.Mock).mockResolvedValue({
            data: { ...serverUser, settingsThemeName: 'dark' },
        });
        const dispatch = jest.fn();
        const actions = createActions();
        await actions.update('u1', { settingsThemeName: 'dark' })(dispatch);

        const updateDispatch = dispatch.mock.calls.find(
            ([action]) => action?.type === SocketClientActionTypes.UPDATE_USER,
        );
        expect(updateDispatch[0].data.settings).toBeDefined();
        expect(updateDispatch[0].data.settings.mobileThemeName).toBe('dark');
    });

    it('dispatches settings when the request includes any settingsEmail* change', async () => {
        const dispatch = jest.fn();
        const actions = createActions();
        await actions.update('u1', { settingsEmailMentions: false })(dispatch);

        const updateDispatch = dispatch.mock.calls.find(
            ([action]) => action?.type === SocketClientActionTypes.UPDATE_USER,
        );
        expect(updateDispatch[0].data.settings).toBeDefined();
    });
});
