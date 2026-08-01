import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * Pact-creation entry-point regression tests.
 *
 * The invite wizard (`CreatePactInvite`) is the only flow that creates a habit
 * goal and its pact invites. For a while it was reachable from exactly two
 * places, both of which disappear once the user is up and running:
 *
 *   - `PactPreviewOverlay`, which `PactOnboardingGuard` stops rendering the
 *     moment `activePacts` is non-empty; and
 *   - the "Invite Someone Else" link inside a Sent-tab invite card, which only
 *     exists while an invite is still outstanding.
 *
 * So a user whose first pact went active — the screenshot case — had no way to
 * start a second one. These tests walk the rendered element trees of both
 * habits surfaces and assert a create affordance is present and wired to
 * `CreatePactInvite`, including in the empty states.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn() },
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

// Constructs a NativeEventEmitter at import time, which throws under Jest.
// Pulled in by the dashboard for check-in proof uploads.
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
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

// Imported after the mocks above deliberately — both screens pull in a chain of
// native modules at import time.
import { PactsList } from '../../main/routes/Pacts/PactsList';
import { HabitsDashboard } from '../../main/routes/Habits/Dashboard';
import NewPactButton from '../../main/components/Habits/NewPactButton';

const CURRENT_USER_ID = 'me';

const ACTIVE_PACT: any = {
    id: 'pact-1',
    creatorUserId: CURRENT_USER_ID,
    habitGoalId: 'goal-1',
    status: 'active',
    members: [],
};

/** Collects every element in a rendered React tree, depth-first. */
const flattenElements = (node: any, collected: any[] = []): any[] => {
    if (Array.isArray(node)) {
        node.forEach((child) => flattenElements(child, collected));
        return collected;
    }
    if (!node || typeof node !== 'object') {
        return collected;
    }
    collected.push(node);
    flattenElements(node.props?.children, collected);
    return collected;
};

const buildPactsList = (habitsOverrides: any = {}) => {
    const navigate = jest.fn();
    const props: any = {
        user: { settings: {}, isAuthenticated: true, details: { id: CURRENT_USER_ID } },
        habits: {
            pacts: [ACTIVE_PACT],
            activePacts: [ACTIVE_PACT],
            pendingInvites: [],
            ...habitsOverrides,
        },
        navigation: { navigate, addListener: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
        getUserPacts: jest.fn(),
        getActivePacts: jest.fn(),
        getPendingInvites: jest.fn(),
        acceptPact: jest.fn(),
        declinePact: jest.fn(),
        nudgePact: jest.fn(),
    };

    const instance = new PactsList(props);
    instance.setState = jest.fn();

    return { instance, navigate };
};

const buildDashboard = (habitsOverrides: any = {}) => {
    const navigate = jest.fn();
    const props: any = {
        user: { settings: {}, isAuthenticated: true, details: { id: CURRENT_USER_ID } },
        habits: {
            habitGoals: [{ id: 'goal-1', name: 'Morning workout' }],
            pacts: [ACTIVE_PACT],
            activePacts: [ACTIVE_PACT],
            pendingInvites: [],
            todayCheckins: [],
            activeStreaks: [],
            ...habitsOverrides,
        },
        navigation: { navigate, addListener: jest.fn(), setOptions: jest.fn() },
        getUserGoals: jest.fn(),
        getTodayCheckins: jest.fn(),
        getActiveStreaks: jest.fn(),
        getActivePacts: jest.fn(),
        getUserPacts: jest.fn(),
        createCheckin: jest.fn(),
    };

    const instance = new HabitsDashboard(props);
    instance.setState = jest.fn();

    return { instance, navigate };
};

describe('pact creation entry points', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('offers a create-pact action on the pacts list even when a pact is already active', () => {
        const { instance, navigate } = buildPactsList();

        const fab = flattenElements(instance.render())
            .find((el: any) => el.type === NewPactButton);

        expect(fab).toBeDefined();

        fab.props.onPress();

        expect(navigate).toHaveBeenCalledWith('CreatePactInvite');
    });

    it('offers a create-pact action on the dashboard even when a pact is already active', () => {
        const { instance, navigate } = buildDashboard();

        const fab = flattenElements(instance.render())
            .find((el: any) => el.type === NewPactButton);

        expect(fab).toBeDefined();

        fab.props.onPress();

        expect(navigate).toHaveBeenCalledWith('CreatePactInvite');
    });

    it('gives the pacts-list empty state a create action, not just copy', () => {
        const { instance, navigate } = buildPactsList({ pacts: [], activePacts: [] });

        const pressable = flattenElements(instance.renderEmptyState())
            .find((el: any) => el.props?.accessibilityRole === 'button');

        expect(pressable).toBeDefined();

        pressable.props.onPress();

        expect(navigate).toHaveBeenCalledWith('CreatePactInvite');
    });

    it('gives the dashboard empty state a create action, not just copy', () => {
        const { instance, navigate } = buildDashboard({ habitGoals: [] });

        const pressable = flattenElements(instance.renderEmptyState())
            .find((el: any) => el.props?.accessibilityRole === 'button');

        expect(pressable).toBeDefined();

        pressable.props.onPress();

        expect(navigate).toHaveBeenCalledWith('CreatePactInvite');
    });
});
