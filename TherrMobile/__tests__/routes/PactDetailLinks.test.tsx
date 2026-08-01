import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * PactDetail navigation-link regression tests.
 *
 * The pact detail screen used to be a dead end: it named the partner in the
 * comparison widget but exposed no way to reach their profile, no way to
 * message them, and no way to get from the pact back to the habit it tracks.
 *
 * Two details are easy to get wrong and are locked in here:
 *
 * 1. The habit link may only be offered when the pact's habit goal is in *this*
 *    user's goal list. Both partners share one `habitGoalId`, but
 *    `habit_goals` rows belong to their creator, so `HabitDetail` — which
 *    resolves off `habits.habitGoals` — renders "Habit not found" for an
 *    invited partner who never owned the goal.
 * 2. The members card lists the *other* members only. Rendering the current
 *    user would offer a "view profile"/"message" link pointed at themselves.
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

// Imported after the mocks above deliberately — PactDetail pulls in a chain of
// native modules at import time.
import { PactDetail } from '../../main/routes/Pacts/PactDetail';

const CURRENT_USER_ID = 'me';

const PARTNER: any = {
    id: 'member-2',
    pactId: 'pact-1',
    userId: 'partner-1',
    role: 'partner',
    status: 'active',
    userName: 'tyler',
    firstName: 'Tyler',
    totalCheckins: 0,
    completedCheckins: 0,
    currentStreak: 0,
    longestStreak: 0,
};

const ME: any = {
    id: 'member-1',
    pactId: 'pact-1',
    userId: CURRENT_USER_ID,
    role: 'creator',
    status: 'active',
    userName: 'me',
    firstName: 'Me',
    totalCheckins: 0,
    completedCheckins: 0,
    currentStreak: 0,
    longestStreak: 0,
};

const PACT: any = {
    id: 'pact-1',
    creatorUserId: CURRENT_USER_ID,
    habitGoalId: 'goal-1',
    pactType: 'accountability',
    status: 'active',
    durationDays: 30,
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-08-31T00:00:00.000Z',
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
    members: [ME, PARTNER],
};

const buildInstance = (habitsOverrides: any = {}) => {
    const navigate = jest.fn();

    const props: any = {
        user: { settings: {}, details: { id: CURRENT_USER_ID } },
        habits: {
            habitGoals: [{ id: 'goal-1' }],
            pacts: [PACT],
            activePacts: [PACT],
            pendingInvites: [],
            ...habitsOverrides,
        },
        navigation: { navigate, setOptions: jest.fn() },
        route: { params: { pactId: 'pact-1' } },
        getPactDetails: jest.fn(() => Promise.resolve(PACT)),
        getUserGoals: jest.fn(() => Promise.resolve([])),
        acceptPact: jest.fn(),
        declinePact: jest.fn(),
        abandonPact: jest.fn(),
    };

    const instance = new PactDetail(props);
    instance.setState = jest.fn();

    return { instance, navigate };
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

describe('PactDetail navigation links', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('navigates to the partner profile by user id', () => {
        const { instance, navigate } = buildInstance();

        instance.goToUserProfile(PARTNER.userId);

        expect(navigate).toHaveBeenCalledWith('ViewUser', {
            userInView: { id: 'partner-1' },
        });
    });

    it('opens a direct message thread with the params DirectMessage reads', () => {
        const { instance, navigate } = buildInstance();

        instance.goToDirectMessage(PARTNER);

        // DirectMessage titles its header off `connectionDetails.userName` and
        // keys its message list off `connectionDetails.id`.
        expect(navigate).toHaveBeenCalledWith('DirectMessage', {
            connectionDetails: { id: 'partner-1', userName: 'tyler' },
        });
    });

    it('navigates to the habit the pact tracks', () => {
        const { instance, navigate } = buildInstance();

        instance.goToHabitDetail('goal-1');

        expect(navigate).toHaveBeenCalledWith('HabitDetail', { habitGoalId: 'goal-1' });
    });

    it('offers the habit link when the user owns the pact habit goal', () => {
        const { instance } = buildInstance({ habitGoals: [{ id: 'goal-other' }, { id: 'goal-1' }] });

        expect(instance.getLinkableHabitGoalId(PACT)).toBe('goal-1');
    });

    it('withholds the habit link from a partner who does not own the goal', () => {
        const { instance } = buildInstance({ habitGoals: [{ id: 'goal-other' }] });

        expect(instance.getLinkableHabitGoalId(PACT)).toBeUndefined();
    });

    it('withholds the habit link before the goal list has loaded', () => {
        const { instance } = buildInstance({ habitGoals: undefined });

        expect(instance.getLinkableHabitGoalId(PACT)).toBeUndefined();
    });

    it('lists the other members and never the current user', () => {
        const { instance, navigate } = buildInstance();

        const card = instance.renderMembersCard(PACT, CURRENT_USER_ID);
        const memberRows = flattenElements(card).filter((el) => el.props?.member);

        expect(memberRows).toHaveLength(1);
        expect(memberRows[0].props.member.userId).toBe('partner-1');

        memberRows[0].props.onPress();
        expect(navigate).toHaveBeenCalledWith('ViewUser', {
            userInView: { id: 'partner-1' },
        });
    });

    it('renders no members card for a pact whose members have not loaded', () => {
        const { instance } = buildInstance();

        expect(instance.renderMembersCard({ ...PACT, members: undefined }, CURRENT_USER_ID)).toBeNull();
        expect(instance.renderMembersCard({ ...PACT, members: [ME] }, CURRENT_USER_ID)).toBeNull();
    });

    it('fetches habit goals alongside the pact so the habit link survives a cold open', () => {
        const { instance } = buildInstance();

        instance.handleRefresh();

        expect(instance.props.getPactDetails).toHaveBeenCalledWith('pact-1');
        expect(instance.props.getUserGoals).toHaveBeenCalled();
    });
});
