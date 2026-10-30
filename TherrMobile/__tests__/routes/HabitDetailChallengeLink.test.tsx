import 'react-native';
import {
    it, describe, expect, jest,
} from '@jest/globals';

/**
 * The habit detail screen's challenge row.
 *
 * "Challenge friends to this habit" used to start a new challenge on every tap, so a user could
 * open several boards on one habit and split the same friends across them. Once the user is on a
 * running challenge for the habit — their own or a friend's — the row opens that one instead.
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
import { HabitsChallengesService } from 'therr-react/services';
import { HabitDetail } from '../../main/routes/Habits/HabitDetail';

const challenge = (overrides: any = {}): any => ({
    id: 'challenge-1',
    joinToken: 'AbCdEf123456',
    title: 'Be Cool',
    habitGoalId: 'goal-1',
    goal: { name: 'Be Cool', emoji: null, amountUnit: null },
    creator: { userName: 'sam', displayName: 'Sam' },
    startDate: '2026-10-20',
    endDate: '2026-11-18',
    status: 'active',
    hasEnded: false,
    memberCount: 2,
    maxMembers: 50,
    isFull: false,
    rankedBy: 'checkinDays',
    standings: [],
    viewer: { isMember: true, isCreator: false, rank: 1 },
    ...overrides,
});

const buildInstance = () => {
    const props: any = {
        user: { settings: { locale: 'en-us' }, details: { id: 'me' } },
        habits: {
            habitGoals: [{ id: 'goal-1', name: 'Be Cool' }], userHabits: [], activePacts: [], pacts: [],
        },
        navigation: { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() },
        route: { params: { habitGoalId: 'goal-1' } },
    };
    const instance = new HabitDetail(props);
    // Not mounted: apply state synchronously so the render methods can read it.
    (instance as any).setState = (update: any) => Object.assign(instance.state, update);

    return { instance, props };
};

const habitGoal: any = { id: 'goal-1', name: 'Be Cool' };
const activeUserHabit: any = { id: 'uh-1', status: 'active' };

const loadWith = async (instance: HabitDetail, challenges: any[]) => {
    jest.spyOn(HabitsChallengesService, 'getMine').mockResolvedValueOnce({ data: { challenges } } as never);
    instance.loadRunningChallenge();
    await new Promise((resolve) => setImmediate(resolve));
};

describe('habit detail challenge row', () => {
    it('starts a challenge when the user is on no running board for this habit', () => {
        const { instance, props } = buildInstance();
        const row: any = instance.renderChallengeLink(habitGoal, activeUserHabit);

        expect(row.props.accessibilityLabel).toBe('Challenge friends to this habit');
        row.props.onPress();
        expect(props.navigation.navigate).toHaveBeenCalledWith('CreateChallenge', { habitGoalId: 'goal-1', habitName: 'Be Cool' });
    });

    it('opens the running challenge instead of starting a second one', async () => {
        const { instance, props } = buildInstance();
        await loadWith(instance, [challenge()]);
        const row: any = instance.renderChallengeLink(habitGoal, activeUserHabit);

        expect(row.props.accessibilityLabel).toBe('View challenge');
        row.props.onPress();
        expect(props.navigation.navigate).toHaveBeenCalledWith('ChallengeDetail', { joinToken: 'AbCdEf123456' });
    });

    it('ignores ended challenges and challenges on another habit', async () => {
        const { instance } = buildInstance();
        await loadWith(instance, [
            challenge({ status: 'ended', hasEnded: true }),
            challenge({ joinToken: 'Other1234567', habitGoalId: 'goal-2' }),
        ]);

        expect(instance.state.runningChallenge).toBeNull();
        expect((instance.renderChallengeLink(habitGoal, activeUserHabit) as any).props.accessibilityLabel)
            .toBe('Challenge friends to this habit');
    });

    it('renders nothing for a habit the user is not actively tracking', () => {
        const { instance } = buildInstance();

        expect(instance.renderChallengeLink(habitGoal, { id: 'uh-1', status: 'archived' } as any)).toBeNull();
    });
});
