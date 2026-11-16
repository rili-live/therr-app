jest.mock('../../../services/UsersService', () => ({
    __esModule: true,
    default: {},
}));

// eslint-disable-next-line import/first
import UsersActions from '../Users';

const createActions = () => new (UsersActions as any)({}, { getItem: jest.fn(), setItem: jest.fn() });

describe('UsersActions.extractUserData', () => {
    // Regression: the habits companion derives "days together" from user.details.createdAt.
    // The whitelist dropped it, so every account read as 0 days old and the companion never grew.
    it('keeps the account createdAt on user details', () => {
        const { userData } = createActions().extractUserData({
            id: 'u1',
            userName: 'user1',
            createdAt: '2026-01-02T03:04:05.000Z',
        });

        expect(userData.createdAt).toBe('2026-01-02T03:04:05.000Z');
    });
});
