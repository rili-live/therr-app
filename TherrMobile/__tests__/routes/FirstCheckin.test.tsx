import { it, describe, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';

jest.mock('react-native-vector-icons/FontAwesome5', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../main/components/BaseStatusBar', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../main/utilities/analyticsEvents', () => ({
    logAppEvent: jest.fn(),
}));
jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn(() => Promise.resolve()) },
}));
jest.mock('../../main/utilities/toasts', () => ({
    showToast: { error: jest.fn(), info: jest.fn(), success: jest.fn() },
    DURATION: { SHORT: 1, DEFAULT: 2, LONG: 3 },
}));
jest.mock('../../main/utilities/habitCapPaywall', () => ({
    getHabitCapPaywallParams: (err: any) => (err?.response?.status === 402 ? { reason: 'habit-limit-reached' } : null),
}));
// Keys, not copy: these assertions are about the flow, not about wording.
jest.mock('../../main/utilities/translator', () => ({
    __esModule: true,
    default: (_locale: string, key: string) => key,
}));

import { FirstCheckin } from '../../main/routes/Habits/FirstCheckin';
import { Button } from '../../main/components/BaseButton';
import { logAppEvent } from '../../main/utilities/analyticsEvents';
import permissions from '../../main/utilities/permissionsOrchestrator';

/**
 * The first session's first check-in (#3010).
 *
 * The user has just picked their first habit. The order is the whole point: the check-in comes
 * first, and the friend comes up only once there is a streak to protect. Of the users who ever
 * checked in, 19 of 26 did it on day one.
 */

const store: any = {
    getState: () => ({ user: { settings: { mobileThemeName: 'light' } } }),
    subscribe: () => () => undefined,
    dispatch: () => undefined,
};

const user: any = { details: { id: 'me' }, settings: { locale: 'en-us' } };
const params = { habitGoalId: 'goal-1', habitName: 'Drink water', habitEmoji: '💧' };

const flush = () => act(async () => { await new Promise((resolve) => { setImmediate(resolve); }); });

const render = (createCheckin: any, routeParams: any = params) => {
    const navigation = {
        setOptions: jest.fn(), navigate: jest.fn(), replace: jest.fn(), reset: jest.fn(),
    };
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
        tree = renderer.create(
            <Provider store={store}>
                <FirstCheckin
                    user={user}
                    navigation={navigation}
                    route={{ params: routeParams }}
                    createCheckin={createCheckin}
                    getActiveStreaks={jest.fn(() => Promise.resolve())}
                />
            </Provider>,
        );
    });
    return { tree: tree as renderer.ReactTestRenderer, navigation };
};

const texts = (tree: renderer.ReactTestRenderer): string[] => tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .filter((child): child is string => typeof child === 'string');

const primary = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(Button)[0];

describe('FirstCheckin', () => {
    beforeEach(() => {
        (logAppEvent as jest.Mock).mockClear();
        (permissions.requestIfAppropriate as jest.Mock).mockClear();
    });

    it('asks for the check-in first, and says nothing about a friend yet', () => {
        const { tree } = render(jest.fn());

        expect(primary(tree).props.title).toBe('pages.firstCheckin.checkinButton');
        expect(texts(tree)).not.toContain('pages.firstCheckin.inviteAsk');
    });

    it('checks in on the user\'s own day, then offers to invite a friend to that habit', async () => {
        const createCheckin = jest.fn(() => Promise.resolve({}));
        const { tree, navigation } = render(createCheckin);

        act(() => { primary(tree).props.onPress(); });
        await flush();

        expect(createCheckin).toHaveBeenCalledWith(expect.objectContaining({ habitGoalId: 'goal-1', status: 'completed' }));
        expect(logAppEvent).toHaveBeenCalledWith('habit_checkin_complete', expect.objectContaining({
            source: 'first_session', isFirstSession: true,
        }));
        expect(permissions.requestIfAppropriate).toHaveBeenCalledWith('notifications', { trigger: 'firstCheckin' });
        expect(texts(tree)).toContain('pages.firstCheckin.doneStreak');
        expect(texts(tree)).toContain('pages.firstCheckin.inviteAsk');

        act(() => { primary(tree).props.onPress(); });
        expect(navigation.replace).toHaveBeenCalledWith('CreatePactInvite', params);
    });

    it('sends the user to the paywall, not an error, at the free-tier cap', async () => {
        const createCheckin = jest.fn(() => Promise.reject({ response: { status: 402 } }));
        const { tree, navigation } = render(createCheckin);

        act(() => { primary(tree).props.onPress(); });
        await flush();

        expect(navigation.navigate).toHaveBeenCalledWith('UpgradePaywall', { reason: 'habit-limit-reached' });
        expect(texts(tree)).not.toContain('pages.firstCheckin.inviteAsk');
    });

    it('goes to the dashboard rather than checking in when opened without a habit', () => {
        const createCheckin = jest.fn();
        const { tree, navigation } = render(createCheckin, {});

        act(() => { primary(tree).props.onPress(); });

        expect(createCheckin).not.toHaveBeenCalled();
        expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'HabitsDashboard' }] });
    });
});
