import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * The pact segments are rendered by a FlatList, and `extraData` is what makes the
 * in-flight state of an Accept / Decline / Nudge / Renew tap visible.
 *
 * VirtualizedList's CellRenderer is a PureComponent, and the only props it is handed
 * are `item`, `index` and `renderItem`. None of those move while a pact action is
 * running: the pact segments render arrays straight off the Redux `habits` slice, so
 * a local `setState({ respondingPactId })` re-renders this screen without changing a
 * single cell prop, and every cell bails out of re-rendering.
 *
 * The visible failure was that the button stayed idle and, worse, stayed *enabled*
 * — `PactCard` drives both its spinner and its `disabled` from those flags — so a
 * second tap could fire a duplicate accept, burn the nudge's 7-day cooldown, or 409
 * a renewal that was already succeeding.
 *
 * These cases pin the FlatList's `extraData` to the pending ids, so a cell always
 * re-renders when one of them moves.
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
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

// Pacts on, so the segmented control and the pact segments render at all.
jest.mock('../../main/utilities/getConfig', () => ({
    __esModule: true,
    default: () => ({ featureFlags: { ENABLE_PACTS: true } }),
}));

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import { HabitsDashboard } from '../../main/routes/Habits/Dashboard';

const PENDING_INVITE = {
    id: 'pact-1',
    status: 'pending',
    creatorUserId: 'them',
    durationDays: 30,
};

const buildInstance = (initialTab?: string) => {
    const props: any = {
        user: { settings: {}, isAuthenticated: true, details: { id: 'me', userName: 'me' } },
        habits: {
            habitGoals: [],
            // Deliberately the *same* array identity on every render, which is what
            // Redux hands this screen and what makes `extraData` load-bearing.
            pacts: [PENDING_INVITE],
            activePacts: [],
            pendingInvites: [PENDING_INVITE],
            todayCheckins: [],
            activeStreaks: [],
        },
        navigation: { navigate: jest.fn(), addListener: jest.fn(), setOptions: jest.fn() },
        route: { params: initialTab ? { initialTab } : {} },
        getUserGoals: jest.fn(),
        getTodayCheckins: jest.fn(),
        getActiveStreaks: jest.fn(),
        getActivePacts: jest.fn(),
        getUserPacts: jest.fn(),
        getPendingInvites: jest.fn(),
        getUserHabitEligibility: jest.fn(),
        createCheckin: jest.fn(),
        acceptPact: jest.fn(),
        declinePact: jest.fn(),
        nudgePact: jest.fn(),
        renewPact: jest.fn(),
    };

    return new HabitsDashboard(props);
};

/** Depth-first walk for the one element in the tree that is a list. */
const findListElement = (node: any): any => {
    if (!node || typeof node !== 'object') {
        return undefined;
    }

    if (Array.isArray(node)) {
        return node.reduce((found: any, child: any) => found || findListElement(child), undefined);
    }

    if (node.props?.renderItem && node.props?.keyExtractor) {
        return node;
    }

    return findListElement(node.props?.children);
};

const getListProps = (instance: any) => {
    const list = findListElement(instance.render());
    expect(list).toBeTruthy();

    return list.props;
};

describe('HabitsDashboard pact action feedback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the pact segments off a stable Redux array', () => {
        // The premise of the bug: nothing about `data` or its rows changes when a
        // pending id is set, so `extraData` is the only thing that can.
        const instance: any = buildInstance('pending');
        const first = getListProps(instance).data;

        instance.state = { ...instance.state, respondingPactId: 'pact-1' };

        expect(getListProps(instance).data).toBe(first);
        expect(getListProps(instance).data[0]).toBe(PENDING_INVITE);
    });

    it('changes extraData while an accept or decline is in flight', () => {
        const instance: any = buildInstance('pending');
        const idle = getListProps(instance).extraData;

        instance.state = { ...instance.state, respondingPactId: 'pact-1' };

        expect(getListProps(instance).extraData).not.toBe(idle);
    });

    it('changes extraData while a nudge is in flight', () => {
        const instance: any = buildInstance('outgoing');
        const idle = getListProps(instance).extraData;

        instance.state = { ...instance.state, nudgingPactId: 'pact-1' };

        expect(getListProps(instance).extraData).not.toBe(idle);
    });

    it('changes extraData while a renewal is in flight', () => {
        const instance: any = buildInstance('all');
        const idle = getListProps(instance).extraData;

        instance.state = { ...instance.state, renewingPactId: 'pact-1' };

        expect(getListProps(instance).extraData).not.toBe(idle);
    });

    it('changes extraData while a check-in is in flight', () => {
        const instance: any = buildInstance('habits');
        const idle = getListProps(instance).extraData;

        instance.state = { ...instance.state, checkinLoadingIds: new Set(['goal-1']) };

        expect(getListProps(instance).extraData).not.toBe(idle);
    });

    it('leaves extraData alone when nothing is pending', () => {
        const instance: any = buildInstance('pending');

        expect(getListProps(instance).extraData).toBe(getListProps(instance).extraData);
    });
});
