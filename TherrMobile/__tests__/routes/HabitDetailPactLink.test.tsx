import 'react-native';
import {
    it, describe, expect, jest,
} from '@jest/globals';

/**
 * The habit detail screen's link to its pact.
 *
 * The dashboard's habit card opens the habit screen, and PactDetail links back to the habit, but
 * nothing linked forward: a user looking at a habit had no way to its pact (members, pledge,
 * renewal) except finding it again under the dashboard's pact tabs.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn(), hide: jest.fn() },
}));

jest.mock('../../main/utilities/toasts', () => ({
    __esModule: true,
    DURATION: {},
    showToast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

// Pulled in transitively via constants; resolves its native module at import time.
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
import { HabitDetail } from '../../main/routes/Habits/HabitDetail';
import { getHabitPact } from '../../main/routes/Habits/pactState';

const member = (userId: string, status: string, firstName: string): any => ({
    id: `member-${userId}`,
    userId,
    role: userId === 'me' ? 'creator' : 'partner',
    status,
    firstName,
});

const pact = (id: string, status: string, overrides: any = {}): any => ({
    id,
    creatorUserId: 'me',
    habitGoalId: 'goal-1',
    status,
    members: [member('me', 'active', 'Me'), member('friend', 'active', 'Sam')],
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
});

describe('getHabitPact', () => {
    it('prefers the active pact over a pending invite and a finished cycle', () => {
        const pending = pact('pending-1', 'pending', { createdAt: '2026-10-01T00:00:00.000Z' });
        const done = pact('done-1', 'completed', { createdAt: '2026-10-02T00:00:00.000Z' });
        const active = pact('active-1', 'active');

        expect(getHabitPact('goal-1', [], [pending, done, active])?.id).toBe('active-1');
        expect(getHabitPact('goal-1', [], [pending, done])?.id).toBe('pending-1');
    });

    it('picks the newest pact within a status', () => {
        const older = pact('older', 'active', { createdAt: '2026-08-01T00:00:00.000Z' });
        const newer = pact('newer', 'active', { createdAt: '2026-09-15T00:00:00.000Z' });

        expect(getHabitPact('goal-1', [older], [newer])?.id).toBe('newer');
    });

    it('offers no abandoned pact, superseded cycle, or another habit\'s pact', () => {
        expect(getHabitPact('goal-1', [], [
            pact('abandoned', 'abandoned'),
            pact('superseded', 'completed', { supersededByPactId: 'next' }),
            pact('other', 'active', { habitGoalId: 'goal-2' }),
        ])).toBeUndefined();
    });

    it('tolerates lists that have not loaded', () => {
        expect(getHabitPact('goal-1', undefined, undefined)).toBeUndefined();
    });
});

const buildInstance = (pacts: any[]) => {
    const props: any = {
        user: { settings: { locale: 'en-us' }, details: { id: 'me' } },
        habits: {
            habitGoals: [{ id: 'goal-1', name: 'Be Cool' }], userHabits: [], activePacts: [], pacts,
        },
        navigation: { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() },
        route: { params: { habitGoalId: 'goal-1' } },
        getUserPacts: jest.fn(() => Promise.resolve([])),
    };

    return { instance: new HabitDetail(props), props };
};

describe('habit detail pact link', () => {
    it('names the partners and opens the pact', () => {
        const { instance, props } = buildInstance([pact('active-1', 'active')]);
        const link: any = instance.renderPactLink();

        expect(link.props.accessibilityLabel).toBe('Pact with Sam');
        link.props.onPress();
        expect(props.navigation.navigate).toHaveBeenCalledWith('PactDetail', { pactId: 'active-1' });
    });

    it('falls back to a plain label when no partner is left to name', () => {
        const { instance } = buildInstance([pact('active-1', 'active', {
            members: [member('me', 'active', 'Me'), member('friend', 'left', 'Sam')],
        })]);

        expect((instance.renderPactLink() as any).props.accessibilityLabel).toBe('View pact');
    });

    it('renders nothing for a habit kept without a pact', () => {
        const { instance } = buildInstance([]);

        expect(instance.renderPactLink()).toBeNull();
    });
});
