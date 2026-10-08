import { it, describe, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';

jest.mock('react-native-vector-icons/FontAwesome5', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: () => undefined,
}));
jest.mock('../../main/components/BaseStatusBar', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../main/utilities/analyticsEvents', () => ({
    logAppEvent: jest.fn(),
}));
// Keys, not copy: these assertions are about which action leads, not about wording.
jest.mock('../../main/utilities/translator', () => ({
    __esModule: true,
    default: (_locale: string, key: string) => key,
}));

// Imported after the mocks: the overlay pulls in vector icons and navigation at module scope.
import PactPreviewOverlay from '../../main/components/Habits/PactPreviewOverlay';
import { Button } from '../../main/components/BaseButton';
import { logAppEvent } from '../../main/utilities/analyticsEvents';

/**
 * The onboarding overlay when a friend's invite is already waiting.
 *
 * In production, 20 of 21 users whose pact was accepted went on to check in, and 27 of the 28
 * invitees who never answered were already Habits users — they had opened the app. The overlay
 * they opened led with "pick a habit & invite a friend" and left their friend's invite as a small
 * text link under the footer. The invite has to lead.
 */

const invite: any = {
    id: 'pact-1',
    creatorUserId: 'friend',
    habitGoalId: 'goal-1',
    habitGoalName: 'Morning run',
    habitGoalEmoji: '🏃',
    pactType: 'accountability',
    status: 'pending',
    durationDays: 30,
};

const user: any = { details: { id: 'me' }, settings: { locale: 'en-us' }, isAuthenticated: true };

// The shared Button reads the theme name through `useSelector`.
const store: any = {
    getState: () => ({ user: { settings: { mobileThemeName: 'light' } } }),
    subscribe: () => () => undefined,
    dispatch: () => undefined,
};

const render = (pendingInvites: any[]) => {
    const navigation = { navigate: jest.fn() };
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
        tree = renderer.create(
            <Provider store={store}>
                <PactPreviewOverlay
                    user={user}
                    habits={{ pendingInvites, pacts: [], templates: [] } as any}
                    navigation={navigation}
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

const primaryButton = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(Button)[0];

describe('PactPreviewOverlay — a friend\'s invite is waiting', () => {
    beforeEach(() => {
        (logAppEvent as jest.Mock).mockClear();
    });

    it('leads with the invite: its habit is shown and the primary button opens it', () => {
        const { tree, navigation } = render([invite]);

        expect(texts(tree)).toContain('Morning run');
        expect(texts(tree)).toContain('pages.pacts.preview.invitedCardHeader');

        const button = primaryButton(tree);
        expect(button.props.title).toBe('pages.pacts.preview.respondToInviteCTA');
        act(() => { button.props.onPress(); });

        expect(navigation.navigate).toHaveBeenCalledWith('HabitsDashboard', { initialTab: 'pending' });
        expect(logAppEvent).toHaveBeenCalledWith('habits_onboarding_invite_open', { userId: 'me', inviteCount: 1 });
    });

    it('keeps starting a pact of their own available, as the secondary action', () => {
        const { tree } = render([invite]);

        expect(texts(tree)).toContain('pages.pacts.preview.startOwnPactCTA');
        expect(texts(tree)).not.toContain('pages.pacts.preview.bannerHelper');
    });

    it('is unchanged for a user with no invite: the primary button starts the wizard', () => {
        const { tree, navigation } = render([]);

        expect(texts(tree)).not.toContain('pages.pacts.preview.invitedCardHeader');
        const button = primaryButton(tree);
        expect(button.props.title).toBe('pages.pacts.preview.bannerCTA');
        act(() => { button.props.onPress(); });

        expect(navigation.navigate).toHaveBeenCalledWith('CreatePactInvite');
    });
});
