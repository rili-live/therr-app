import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * The create-pact wizard at the free-tier habit cap (#2922).
 *
 * The wizard used to fetch `isAtHabitLimit` on mount and never read it. A capped user
 * built the whole habit, tapped create, and only then found out. By that point
 * `resolveHabitGoalId` had already written a `habits.habit_goals` row, so each attempt
 * left an orphaned goal behind. The final actions now re-check the cap before creating
 * anything, and fail open so the server stays the authority.
 */

const mockToastShow = jest.fn();
let mockLifetimeOfferEnabled = true;

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: (...args: any[]) => mockToastShow(...args) },
}));

jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

jest.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../main/utilities/getConfig', () => {
    const actual: any = jest.requireActual('../../main/utilities/getConfig');
    const getActualConfig = actual.default || actual;
    return {
        __esModule: true,
        default: () => {
            const config = getActualConfig();
            return {
                ...config,
                featureFlags: { ...config.featureFlags, ENABLE_HABITS_LIFETIME_OFFER: mockLifetimeOfferEnabled },
            };
        },
    };
});

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import { CreatePactInvite } from '../../main/routes/Pacts/CreatePactInvite';

const buildWizard = ({
    eligibility,
    eligibilityError,
    cachedEligibility = null,
}: { eligibility?: any; eligibilityError?: any; cachedEligibility?: any }) => {
    const props: any = {
        user: { settings: {}, isAuthenticated: true, details: { id: 'me' } },
        habits: {
            templates: [], habitGoals: [], pacts: [], userHabitEligibility: cachedEligibility,
        },
        userConnections: { connections: [] },
        navigation: { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
        getTemplates: jest.fn(),
        createGoal: jest.fn(),
        bulkInvitePact: jest.fn(() => Promise.resolve()),
        startUserHabit: jest.fn(() => Promise.resolve()),
        getUserHabitEligibility: jest.fn(() => (eligibilityError
            ? Promise.reject(eligibilityError)
            : Promise.resolve(eligibility))),
        searchUsers: jest.fn(),
    };

    const instance = new CreatePactInvite(props);
    instance.setState = jest.fn() as any;
    instance.state = { ...instance.state, selectedPartnerIds: ['partner-1'] };
    instance.resolveHabitGoalId = jest.fn(() => Promise.resolve('goal-1')) as any;

    return { instance, props };
};

const AT_CAP = {
    canCreateSolo: true, activeHabitCount: 5, isAtHabitLimit: true, habitLimit: 5,
};
const UNDER_CAP = {
    canCreateSolo: true, activeHabitCount: 2, isAtHabitLimit: false, habitLimit: 5,
};

describe('create-pact wizard — habit cap', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLifetimeOfferEnabled = true;
    });

    it('stops before creating a goal when a fresh check says the user is capped', async () => {
        const { instance, props } = buildWizard({ eligibility: AT_CAP });

        await instance.handleSend();

        expect(instance.resolveHabitGoalId).not.toHaveBeenCalled();
        expect(props.bulkInvitePact).not.toHaveBeenCalled();
        expect(props.navigation.navigate).toHaveBeenCalledWith('UpgradePaywall', {
            reason: 'habit-limit-reached',
            limit: 5,
        });
    });

    it('guards the solo path the same way', async () => {
        const { instance, props } = buildWizard({ eligibility: AT_CAP });

        await instance.handleStartSolo();

        expect(instance.resolveHabitGoalId).not.toHaveBeenCalled();
        expect(props.startUserHabit).not.toHaveBeenCalled();
    });

    it('explains the cap in a toast when the paywall route is not registered', async () => {
        mockLifetimeOfferEnabled = false;
        const { instance, props } = buildWizard({ eligibility: AT_CAP });

        await instance.handleSend();

        expect(instance.resolveHabitGoalId).not.toHaveBeenCalled();
        expect(props.navigation.navigate).not.toHaveBeenCalledWith('UpgradePaywall', expect.anything());
        expect(mockToastShow).toHaveBeenCalledTimes(1);
        expect((mockToastShow.mock.calls[0][0] as any).type).toBe('info');
    });

    it('trusts the fresh fetch over a stale capped cache', async () => {
        // The user archived a habit or bought the unlock after this screen mounted.
        const { instance, props } = buildWizard({ eligibility: UNDER_CAP, cachedEligibility: AT_CAP });

        await instance.handleSend();

        expect(props.bulkInvitePact).toHaveBeenCalled();
    });

    it('fails open when the eligibility fetch fails, leaving the server to refuse', async () => {
        const { instance, props } = buildWizard({ eligibilityError: new Error('offline') });

        await instance.handleSend();

        expect(props.bulkInvitePact).toHaveBeenCalled();
    });

    it('fails open on an empty (offline-fallback) eligibility response', async () => {
        const { instance, props } = buildWizard({ eligibility: undefined });

        await instance.handleStartSolo();

        expect(props.startUserHabit).toHaveBeenCalledWith({ habitGoalId: 'goal-1' });
    });

    it('only shows the notice when the cached eligibility says capped', () => {
        expect(buildWizard({ cachedEligibility: AT_CAP }).instance.renderHabitLimitNotice()).not.toBeNull();
        expect(buildWizard({ cachedEligibility: UNDER_CAP }).instance.renderHabitLimitNotice()).toBeNull();
        expect(buildWizard({ cachedEligibility: null }).instance.renderHabitLimitNotice()).toBeNull();
    });
});
