import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * The habits dashboard absorbed the pacts list, so `initialTab` — which used to
 * select a segment on a screen of its own — now has to survive the merge.
 *
 * Two things are pinned here because breaking either is silent:
 *
 *   1. `initialTab: 'active'` still resolves. That was the pacts list's name for
 *      the segment the Habits segment replaced, and it is what an in-flight push
 *      notification or a warm navigation state carries across an upgrade. An
 *      unrecognised value must land on Habits, not on a blank list.
 *   2. Opening onto a pact segment bypasses `PactOnboardingGuard`. A user with a
 *      pact invite waiting has not "started" by the guard's tests, so a blanket
 *      gate answers the notification telling them they have an invite with the
 *      onboarding overlay — and swallows the invite entirely.
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

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import { HabitsDashboard, normalizeInitialTab, TAB_LABEL_KEYS } from '../../main/routes/Habits/Dashboard';

const buildInstance = (initialTab?: string, habitsOverrides: any = {}) => {
    const props: any = {
        user: { settings: {}, isAuthenticated: true, details: { id: 'me' } },
        habits: {
            habitGoals: [],
            pacts: [],
            activePacts: [],
            pendingInvites: [],
            todayCheckins: [],
            activeStreaks: [],
            ...habitsOverrides,
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
    };

    return new HabitsDashboard(props);
};

describe('normalizeInitialTab', () => {
    it('keeps the pacts list\'s old "active" tab working', () => {
        expect(normalizeInitialTab('active')).toBe('habits');
    });

    it('passes through the segments that still exist', () => {
        expect(normalizeInitialTab('pending')).toBe('pending');
        expect(normalizeInitialTab('outgoing')).toBe('outgoing');
        expect(normalizeInitialTab('all')).toBe('all');
        expect(normalizeInitialTab('habits')).toBe('habits');
    });

    it('falls back to habits for an absent or unrecognised value', () => {
        expect(normalizeInitialTab()).toBe('habits');
        expect(normalizeInitialTab('nonsense')).toBe('habits');
    });
});

describe('HabitsDashboard onboarding guard bypass', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('bypasses the guard when opened onto a pact segment', () => {
        ['pending', 'outgoing', 'all'].forEach((tab) => {
            expect(buildInstance(tab).isOnboardingBypassed()).toBe(true);
        });
    });

    it('keeps the guard for the habits segment and for a plain visit', () => {
        expect(buildInstance('habits').isOnboardingBypassed()).toBe(false);
        expect(buildInstance().isOnboardingBypassed()).toBe(false);
        // The tab bar's own default — a user with active pacts lands here.
        expect(buildInstance('active').isOnboardingBypassed()).toBe(false);
    });

    it('opens on the segment it was asked for', () => {
        expect(buildInstance('outgoing').state.activeTab).toBe('outgoing');
        expect(buildInstance().state.activeTab).toBe('habits');
    });
});

/**
 * The segment labelled "Pending" used to render `pages.pacts.status.pending` —
 * the exact string the pact status badge renders. One screen therefore used the
 * word twice with two meanings: the segment meant "waiting on you", the badge
 * meant "not started yet". A user holding two sent invites saw an empty
 * "Pending" segment beside an "All" segment listing two pacts badged "Pending",
 * which is the confusion these cases exist to prevent recurring.
 */
describe('HabitsDashboard segment labels', () => {
    it('does not name the invites segment after a pact status', () => {
        const instance: any = buildInstance();
        const labelKeys = Object.values(TAB_LABEL_KEYS);

        expect(TAB_LABEL_KEYS.pending).toBe('pages.pacts.invitesTabLabel');
        expect(labelKeys).not.toContain('pages.pacts.status.pending');
        expect(instance).toBeTruthy();
    });

    it('gives every segment a distinct label key', () => {
        const labelKeys = Object.values(TAB_LABEL_KEYS);

        expect(new Set(labelKeys).size).toBe(labelKeys.length);
    });
});

describe('HabitsDashboard segment counts', () => {
    const pact = (overrides: any = {}) => ({
        id: 'p1', status: 'pending', creatorUserId: 'me', ...overrides,
    });

    it('counts received invites on the invites segment', () => {
        const instance: any = buildInstance(undefined, {
            pendingInvites: [pact({ id: 'in1', creatorUserId: 'them' })],
        });

        expect(instance.getTabCount('pending')).toBe(1);
    });

    it('counts sent invites on the sent segment', () => {
        const instance: any = buildInstance(undefined, {
            pacts: [pact({ id: 'a' }), pact({ id: 'b' }), pact({ id: 'c', creatorUserId: 'them' })],
        });

        expect(instance.getTabCount('outgoing')).toBe(2);
    });

    it('leaves Habits and All uncounted', () => {
        // Habits is the default landing segment and All is a superset of the
        // other two, so a number on either reports nothing new.
        const instance: any = buildInstance(undefined, {
            pacts: [pact()],
            pendingInvites: [pact({ id: 'in1', creatorUserId: 'them' })],
            habitGoals: [{ id: 'g1', name: 'Read' }],
        });

        expect(instance.getTabCount('habits')).toBe(0);
        expect(instance.getTabCount('all')).toBe(0);
    });
});
