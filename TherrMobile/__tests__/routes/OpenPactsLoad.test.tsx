import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * OpenPacts list loading.
 *
 * 1. A failed read used to render the same "No open pacts for this habit yet" state as a real empty
 *    answer, so an offline user was told nobody had an open pact — and given no way to retry. The
 *    interceptor makes this easy to get wrong: it answers a transient GET failure with a resolved
 *    `{ data: {}, isOfflineFallback: true }`, not a rejection.
 * 2. "n of 6 spots" came from a hard-coded copy of the server's seat ceiling. It now comes from the
 *    response, and a server that predates the field gets a line with no ceiling rather than a guess.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn() },
}));

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {},
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
    AndroidChannel: {},
}));

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

const mockGetOpenPacts = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('therr-react/services', () => ({
    PactsService: {
        getOpenPacts: (...args: any[]) => mockGetOpenPacts(...args),
    },
}));

// Imported after the mocks above deliberately — the screen pulls in native modules at import time.
import { OpenPacts } from '../../main/routes/Pacts/OpenPacts';

const OPEN_PACT: any = {
    id: 'pact-1',
    status: 'pending',
    habitGoalId: 'goal-1',
    durationDays: 30,
    createdAt: '2026-10-01T00:00:00.000Z',
    creatorUserId: 'creator-1',
    creatorUserName: 'sam',
    habitGoalName: 'Read',
    memberCount: 2,
    hasPendingJoinRequest: false,
};

const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

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

const renderedText = (instance: any): string => flattenElements(instance.render())
    .map((el) => el.props?.children)
    .filter((child) => typeof child === 'string')
    .join('\n');

const buildInstance = () => {
    const props: any = {
        user: { settings: { locale: 'en-us' }, details: { id: 'me' } },
        navigation: { navigate: jest.fn(), setOptions: jest.fn() },
        route: { params: { habitGoalId: 'goal-1' } },
    };
    const instance: any = new OpenPacts(props);
    // Applied synchronously so the test can read the state each answer leaves behind.
    instance.setState = (update: any) => {
        const next = typeof update === 'function' ? update(instance.state) : update;
        instance.state = { ...instance.state, ...next };
    };
    return instance;
};

describe('OpenPacts list loading', () => {
    beforeEach(() => {
        mockGetOpenPacts.mockReset();
    });

    it('shows a retryable error, not "no open pacts", when the read falls back offline', async () => {
        mockGetOpenPacts.mockResolvedValue({ data: {}, isOfflineFallback: true });
        const instance = buildInstance();

        instance.handleRefresh();
        await flushPromises();

        expect(instance.state.loadError).toBe(true);
        const text = renderedText(instance);
        expect(text).toContain("We couldn't load open pacts");
        expect(text).not.toContain('No open pacts for this habit yet');
        expect(flattenElements(instance.render()).some((el) => el.props?.onPress === instance.handleRefresh)).toBe(true);
    });

    it('shows the error when the read is refused outright', async () => {
        mockGetOpenPacts.mockRejectedValue({ statusCode: 500 });
        const instance = buildInstance();

        instance.handleRefresh();
        await flushPromises();

        expect(instance.state.loadError).toBe(true);
    });

    it('keeps the list already on screen when a refresh fails', async () => {
        mockGetOpenPacts
            .mockResolvedValueOnce({ data: { pacts: [OPEN_PACT], maxMembers: 6 } })
            .mockResolvedValueOnce({ data: {}, isOfflineFallback: true });
        const instance = buildInstance();

        instance.handleRefresh();
        await flushPromises();
        instance.handleRefresh();
        await flushPromises();

        expect(instance.state.pacts).toEqual([OPEN_PACT]);
        expect(renderedText(instance)).toContain('Read');
    });

    it('shows the empty state for a successful empty answer', async () => {
        mockGetOpenPacts.mockResolvedValue({ data: { pacts: [], maxMembers: 6 } });
        const instance = buildInstance();

        instance.handleRefresh();
        await flushPromises();

        expect(instance.state.loadError).toBe(false);
        expect(renderedText(instance)).toContain('No open pacts for this habit yet');
    });

    it('takes the seat ceiling from the server', async () => {
        mockGetOpenPacts.mockResolvedValue({ data: { pacts: [OPEN_PACT], maxMembers: 8 } });
        const instance = buildInstance();

        instance.handleRefresh();
        await flushPromises();

        expect(renderedText(instance)).toContain('By sam · 2 of 8 spots · 30 days');
    });

    it('leaves the ceiling out for a server that does not send one', async () => {
        mockGetOpenPacts.mockResolvedValue({ data: { pacts: [OPEN_PACT] } });
        const instance = buildInstance();

        instance.handleRefresh();
        await flushPromises();

        const text = renderedText(instance);
        expect(text).toContain('By sam · 2 members · 30 days');
        expect(text).not.toContain('spots');
    });
});
