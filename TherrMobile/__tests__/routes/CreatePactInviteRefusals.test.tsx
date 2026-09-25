import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * How the create-pact wizard reacts when the server refuses to start a habit.
 *
 * The refusal handlers used to read `err.response.status`. That is the axios
 * error shape, but the app's response interceptor (`main/interceptors.ts`)
 * rejects with the response *body* instead, so `err.response` was always
 * undefined. A 402 at the free-tier habit cap and a 403 solo lock both fell
 * through to the generic "We could not start that habit" toast, and the
 * paywall could not be reached from this screen at all.
 *
 * The errors below are built in the shape the interceptor actually produces:
 * the gateway's error body, whose `statusCode` echoes the HTTP status.
 */

const mockToastShow = jest.fn();

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

// Pinned rather than read from env-config, which resolves flags per brand: the
// paywall route only exists with the lifetime offer switched on.
jest.mock('../../main/utilities/getConfig', () => {
    const actual: any = jest.requireActual('../../main/utilities/getConfig');
    const getActualConfig = actual.default || actual;
    return {
        __esModule: true,
        default: () => {
            const config = getActualConfig();
            return {
                ...config,
                featureFlags: { ...config.featureFlags, ENABLE_HABITS_LIFETIME_OFFER: true },
            };
        },
    };
});

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import { CreatePactInvite } from '../../main/routes/Pacts/CreatePactInvite';

const buildWizard = (startUserHabitError: any) => {
    const props: any = {
        user: { settings: {}, isAuthenticated: true, details: { id: 'me' } },
        habits: { templates: [], habitGoals: [], pacts: [] },
        userConnections: { connections: [] },
        navigation: { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
        getTemplates: jest.fn(),
        createGoal: jest.fn(),
        bulkInvitePact: jest.fn(),
        startUserHabit: jest.fn(() => Promise.reject(startUserHabitError)),
        getUserHabitEligibility: jest.fn(() => Promise.resolve()),
        searchUsers: jest.fn(),
    };

    const instance = new CreatePactInvite(props);
    instance.setState = jest.fn() as any;
    instance.resolveHabitGoalId = jest.fn(() => Promise.resolve('goal-1')) as any;

    return { instance, props };
};

describe('create-pact wizard — server refusals', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('routes a 402 at the habit cap to the paywall', async () => {
        const { instance, props } = buildWizard({
            statusCode: 402,
            message: 'Free accounts can track 5 habits at a time.',
            error: 'habit-limit-reached',
            limit: 5,
            upgradeRequired: true,
        });

        await instance.handleStartSolo();

        expect(props.navigation.navigate).toHaveBeenCalledWith('UpgradePaywall', {
            reason: 'habit-limit-reached',
            limit: 5,
            source: 'create-pact',
        });
        expect(mockToastShow).not.toHaveBeenCalled();
    });

    it('explains a 403 solo lock instead of reporting a failure', async () => {
        const { instance, props } = buildWizard({
            statusCode: 403,
            error: 'solo-locked',
            invitedCount: 1,
            requiredCount: 3,
        });

        await instance.handleStartSolo();

        expect(props.navigation.navigate).not.toHaveBeenCalledWith('UpgradePaywall', expect.anything());
        expect(mockToastShow).toHaveBeenCalledTimes(1);
        expect((mockToastShow.mock.calls[0][0] as any).type).toBe('info');
        expect(props.getUserHabitEligibility).toHaveBeenCalled();
    });

    it('still accepts the raw axios error shape', async () => {
        const { instance, props } = buildWizard({
            response: { status: 402, data: { error: 'habit-limit-reached', limit: 5 } },
        });

        await instance.handleStartSolo();

        expect(props.navigation.navigate).toHaveBeenCalledWith('UpgradePaywall', {
            reason: 'habit-limit-reached',
            limit: 5,
            source: 'create-pact',
        });
    });

    it('shows the generic error for anything else', async () => {
        const { instance, props } = buildWizard({ statusCode: 500, message: 'An unexpected error occurred' });

        await instance.handleStartSolo();

        expect(props.navigation.navigate).not.toHaveBeenCalledWith('UpgradePaywall', expect.anything());
        expect(mockToastShow).toHaveBeenCalledTimes(1);
        expect((mockToastShow.mock.calls[0][0] as any).type).toBe('error');
    });
});
