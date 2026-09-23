import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * The capacity strip at the top of the habits list: "4 of 5" in the last slot,
 * "all 5" at the cap, and nothing otherwise. The gating itself is covered in
 * `utilities/upgradeNudge.test.ts`; these pin what the dashboard does with the
 * answer — the copy it picks, where the tap goes, and that the offers are
 * fetched off the refresh path so they can never hold the spinner.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn(), hide: jest.fn() },
}));

jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {},
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
    AndroidChannel: {},
}));

jest.mock('react-native-image-crop-picker', () => ({
    __esModule: true,
    default: { openPicker: jest.fn(), openCamera: jest.fn() },
}));

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), wrap: jest.fn() },
}));

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-permissions', () => ({
    __esModule: true,
    requestMultiple: jest.fn(() => Promise.resolve({})),
    checkMultiple: jest.fn(() => Promise.resolve({})),
    check: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

let mockIsOfferEnabled = true;

jest.mock('../../main/utilities/getConfig', () => {
    const actual: any = jest.requireActual('../../main/utilities/getConfig');
    const getActualConfig = actual.default || actual;
    return {
        __esModule: true,
        default: () => {
            const config = getActualConfig();
            return {
                ...config,
                featureFlags: { ...config.featureFlags, ENABLE_HABITS_LIFETIME_OFFER: mockIsOfferEnabled },
            };
        },
    };
});

import { HabitsDashboard } from '../../main/routes/Habits/Dashboard';

const LIFETIME_OFFER: any = {
    productId: 'habits_founder_unlock',
    total: 5000,
    claimed: 18,
    remaining: 4982,
    isSoldOut: false,
    isEntitled: false,
    purchase: null,
    isStoreConfigured: true,
};

const activeHabits = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `uh-${i}`, status: 'active' }));

const buildInstance = (habitsOverrides: any = {}) => {
    const props: any = {
        user: { settings: {}, details: { id: 'me' } },
        habits: {
            habitGoals: [], todayCheckins: [], streaks: [], pacts: [], activePacts: [], pendingInvites: [],
            userHabits: activeHabits(5),
            lifetimeOffer: LIFETIME_OFFER,
            premiumOffer: null,
            ...habitsOverrides,
        },
        navigation: { navigate: jest.fn(), addListener: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
        getUserGoals: jest.fn(() => Promise.resolve()),
        getTodayCheckins: jest.fn(() => Promise.resolve()),
        getActiveStreaks: jest.fn(() => Promise.resolve()),
        getActivePacts: jest.fn(() => Promise.resolve()),
        getUserPacts: jest.fn(() => Promise.resolve()),
        getPendingInvites: jest.fn(() => Promise.resolve()),
        getUserHabitEligibility: jest.fn(() => Promise.resolve()),
        getUserHabits: jest.fn(() => Promise.resolve()),
        getLifetimeOffer: jest.fn(() => Promise.reject(new Error('offline'))),
        getPremiumOffer: jest.fn(() => Promise.reject(new Error('offline'))),
        createCheckin: jest.fn(),
        acceptPact: jest.fn(),
        declinePact: jest.fn(),
        nudgePact: jest.fn(),
        renewPact: jest.fn(),
    };

    const instance = new HabitsDashboard(props);
    instance.setState = jest.fn((partial: any) => {
        instance.state = { ...instance.state, ...partial };
    }) as any;

    return { instance, props };
};

describe('habits dashboard — capacity nudge', () => {
    beforeEach(() => {
        mockIsOfferEnabled = true;
        jest.clearAllMocks();
    });

    it('renders the at-cap strip and sends the tap to the paywall as a limit', () => {
        const { instance, props } = buildInstance();

        const nudge: any = instance.renderUpgradeNudge();

        expect(nudge).not.toBeNull();
        expect(nudge.props.source).toBe('dashboard-capacity');
        expect(nudge.props.title).toBe('All 5 free habits in use');

        nudge.props.onPress();
        expect(props.navigation.navigate).toHaveBeenCalledWith('UpgradePaywall', {
            source: 'dashboard-capacity',
            reason: 'habit-limit-reached',
            limit: 5,
        });
    });

    it('renders the last-slot strip as an offer, not a limit', () => {
        const { instance, props } = buildInstance({ userHabits: activeHabits(4) });

        const nudge: any = instance.renderUpgradeNudge();

        expect(nudge.props.title).toBe('4 of 5 free habits in use');

        nudge.props.onPress();
        expect(props.navigation.navigate).toHaveBeenCalledWith('UpgradePaywall', {
            source: 'dashboard-capacity',
        });
    });

    it('renders nothing with room to spare, before the registry loads, or with the flag off', () => {
        expect(buildInstance({ userHabits: activeHabits(2) }).instance.renderUpgradeNudge()).toBeNull();
        expect(buildInstance({ userHabits: undefined }).instance.renderUpgradeNudge()).toBeNull();

        mockIsOfferEnabled = false;
        expect(buildInstance().instance.renderUpgradeNudge()).toBeNull();
    });

    it('renders nothing for an entitled account or with no purchasable offer', () => {
        expect(buildInstance({
            lifetimeOffer: { ...LIFETIME_OFFER, isEntitled: true, purchase: { founderNumber: 1 } },
        }).instance.renderUpgradeNudge()).toBeNull();
        expect(buildInstance({ lifetimeOffer: null }).instance.renderUpgradeNudge()).toBeNull();
    });

    it('fetches both offers on refresh without holding the refresh on them', async () => {
        const { instance, props } = buildInstance();

        instance.handleRefresh();
        await new Promise<void>((resolve) => { setImmediate(resolve); });

        expect(props.getLifetimeOffer).toHaveBeenCalledTimes(1);
        expect(props.getPremiumOffer).toHaveBeenCalledTimes(1);
        // Both rejected above; the refresh still settled.
        expect(instance.state.isRefreshing).toBe(false);
        expect(instance.state.hasFetched).toBe(true);
    });

    it('never calls the offer endpoints with the flag off', () => {
        mockIsOfferEnabled = false;
        const { instance, props } = buildInstance();

        instance.handleRefresh();

        expect(props.getLifetimeOffer).not.toHaveBeenCalled();
        expect(props.getPremiumOffer).not.toHaveBeenCalled();
    });
});
