import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * Charity pledges on the pact detail screen (WORK_IN_PROGRESS § 2.8, Phase A; #2990).
 *
 * Locks in the two things the screen decides on its own: when the pledge card is offered at all
 * (it must never offer a button the server's guard refuses), and that a failed save resolves
 * false so the editor keeps what the user picked.
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
import Toast from 'react-native-toast-message';
import { PactDetail } from '../../main/routes/Pacts/PactDetail';
import { logEvent } from '@react-native-firebase/analytics';
import PledgeCard from '../../main/components/Habits/PledgeCard';

const CURRENT_USER_ID = 'me';
const PLEDGE = { amount: 10, charityKey: 'wwf', pledgedAt: '2026-09-01T12:00:00.000Z' };

const member = (userId: string, overrides: any = {}): any => ({
    id: `member-${userId}`,
    pactId: 'pact-1',
    userId,
    role: userId === CURRENT_USER_ID ? 'creator' : 'partner',
    status: 'active',
    totalCheckins: 0,
    completedCheckins: 0,
    currentStreak: 0,
    longestStreak: 0,
    ...overrides,
});

const buildPact = (overrides: any = {}): any => ({
    id: 'pact-1',
    creatorUserId: CURRENT_USER_ID,
    habitGoalId: 'goal-1',
    pactType: 'accountability',
    status: 'active',
    durationDays: 30,
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2099-01-01T00:00:00.000Z',
    members: [member(CURRENT_USER_ID), member('partner-1')],
    ...overrides,
});

const buildInstance = (pact: any, dispatchOverrides: any = {}) => {
    const props: any = {
        user: { settings: {}, details: { id: CURRENT_USER_ID } },
        habits: {
            habitGoals: [{ id: 'goal-1' }],
            pacts: [pact],
            activePacts: [pact],
            pendingInvites: [],
        },
        navigation: { navigate: jest.fn(), setParams: jest.fn(), setOptions: jest.fn() },
        route: { params: { pactId: 'pact-1' } },
        getPactDetails: jest.fn(() => Promise.resolve(pact)),
        getUserGoals: jest.fn(() => Promise.resolve([])),
        setPactPledge: jest.fn(() => Promise.resolve({ pactId: 'pact-1', pledge: PLEDGE })),
        removePactPledge: jest.fn(() => Promise.resolve({ pactId: 'pact-1', pledge: null })),
        ...dispatchOverrides,
    };

    const instance = new PactDetail(props);
    instance.state = { ...instance.state };
    instance.setState = jest.fn();

    return { instance, props };
};

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

const findPledgeCard = (instance: any) => flattenElements(instance.render())
    .find((el) => el.type === PledgeCard);

describe('PactDetail — pledge card visibility', () => {
    it('offers the card to an active member of a running pact', () => {
        const card = findPledgeCard(buildInstance(buildPact()).instance);
        expect(card).toBeDefined();
        expect(card.props.pledge).toBeNull();
        expect(card.props.canAdd).toBe(true);
    });

    it('hands the card the member\'s own pledge, never a partner\'s', () => {
        const pact = buildPact({
            members: [member(CURRENT_USER_ID), member('partner-1', { pledge: PLEDGE })],
        });
        expect(findPledgeCard(buildInstance(pact).instance).props.pledge).toBeNull();

        const mine = buildPact({ members: [member(CURRENT_USER_ID, { pledge: PLEDGE }), member('partner-1')] });
        expect(findPledgeCard(buildInstance(mine).instance).props.pledge).toEqual(PLEDGE);
    });

    it('withholds a new pledge on a pact the member is keeping alone', () => {
        const card = findPledgeCard(buildInstance(buildPact({ isSolo: true })).instance);
        expect(card.props.canAdd).toBe(false);
    });

    it('hides the card from a pending invitee and on a pact past its end date', () => {
        const invited = buildPact({
            creatorUserId: 'partner-1',
            status: 'pending',
            members: [member(CURRENT_USER_ID, { status: 'pending', role: 'partner' }), member('partner-1')],
        });
        expect(findPledgeCard(buildInstance(invited).instance)).toBeUndefined();

        const ended = buildPact({ endDate: '2026-01-01T00:00:00.000Z' });
        expect(findPledgeCard(buildInstance(ended).instance)).toBeUndefined();
    });
});

describe('PactDetail — saving a pledge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('saves the caller\'s own pledge, resolves true, and records adoption', async () => {
        const { instance, props } = buildInstance(buildPact());

        await expect(instance.handleSavePledge(10, 'wwf')).resolves.toBe(true);

        expect(props.setPactPledge).toHaveBeenCalledWith('pact-1', CURRENT_USER_ID, { amount: 10, charityKey: 'wwf' });
        expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'habit_pledge_set', expect.objectContaining({
            amount: 10,
            charityKey: 'wwf',
        }));
    });

    it('records an edit as an update, not a second adoption', async () => {
        const pact = buildPact({ members: [member(CURRENT_USER_ID, { pledge: PLEDGE }), member('partner-1')] });
        const { instance } = buildInstance(pact);

        await instance.handleSavePledge(20, 'wwf');

        expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'habit_pledge_update', expect.anything());
    });

    it('resolves false on a refusal and shows the server\'s own message', async () => {
        const { instance } = buildInstance(buildPact(), {
            setPactPledge: jest.fn(() => Promise.reject({ statusCode: 409, message: 'This pact has ended' })),
        });

        await expect(instance.handleSavePledge(10, 'wwf')).resolves.toBe(false);

        expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
            type: 'error',
            text2: 'This pact has ended',
        }));
        expect(logEvent).not.toHaveBeenCalled();
    });
});
