import 'react-native';
import React from 'react';
import { Provider } from 'react-redux';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

// `main/constants` (the source of the onboarding name placeholders) pulls in
// notifee, which reaches for its native module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: { createChannel: jest.fn() },
    AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
    AndroidVisibility: { PUBLIC: 1 },
}));

jest.mock('therr-react/services', () => ({
    UsersService: {
        getUserInterests: jest.fn().mockResolvedValue({ data: [] }),
    },
}));

import ProfileCompletionCard from '../../main/components/ProfileCompletionCard';
import { markContactsSkipped, markContactsSynced, markInterestsSelected } from '../../main/utilities/profileCompletion';

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const mockStore = {
    getState: () => ({ user: { settings: { mobileThemeName: 'light' } } }),
    subscribe: () => () => {},
    dispatch: () => {},
};

const translate = (key: string) => key;

const buildUser = (details: any = {}) => ({
    details: {
        id: 'user-123',
        userName: 'testuser',
        ...details,
    },
    settings: { mobileThemeName: 'light', locale: 'en-us' },
} as any);

const completeUser = buildUser({
    firstName: 'Zack',
    lastName: 'Anselm',
    phoneNumber: '+15555555555',
    media: { profilePicture: { path: 'some/path.jpeg' } },
});

const buildNavigation = () => ({
    navigate: jest.fn(),
    addListener: jest.fn().mockReturnValue(jest.fn()),
});

const renderCard = async (props: any) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <Provider store={mockStore as any}>
                <ProfileCompletionCard {...props} />
            </Provider>
        );
        await Promise.resolve();
    });
    return component!;
};

// Pressable renders a host View that carries the label but not the handler, so
// match on the composite node that actually owns onPress.
const findByLabel = (component: renderer.ReactTestRenderer, label: string) =>
    component.root.findAll((node) => node.props?.accessibilityLabel === label
        && typeof node.props?.onPress === 'function');

beforeEach(async () => {
    await AsyncStorage.clear();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('ProfileCompletionCard', () => {
    it('lists every outstanding step for a new profile', async () => {
        const component = await renderCard({
            navigation: buildNavigation(),
            translate,
            user: buildUser(),
            themeName: 'light',
        });

        const tree = JSON.stringify(component.toJSON());
        expect(tree).toContain('components.profileCompletionCard.title');
        expect(tree).toContain('components.profileCompletionCard.steps.name.label');
        expect(tree).toContain('components.profileCompletionCard.steps.contacts.label');
        // 5 outstanding steps → plural copy.
        expect(tree).toContain('components.profileCompletionCard.stepsLeft');
    });

    it('uses singular copy when a single step remains', async () => {
        await markInterestsSelected('user-123');
        await markContactsSynced('user-123');

        const component = await renderCard({
            navigation: buildNavigation(),
            translate,
            user: buildUser({
                firstName: 'Zack',
                lastName: 'Anselm',
                phoneNumber: '+15555555555',
            }),
            themeName: 'light',
        });

        const tree = JSON.stringify(component.toJSON());
        expect(tree).toContain('components.profileCompletionCard.stepLeft');
        expect(tree).not.toContain('components.profileCompletionCard.stepsLeft');
    });

    it('renders nothing once every step is resolved', async () => {
        await markInterestsSelected('user-123');
        await markContactsSynced('user-123');

        const component = await renderCard({
            navigation: buildNavigation(),
            translate,
            user: completeUser,
            themeName: 'light',
        });

        expect(component.toJSON()).toBeNull();
    });

    it('counts a skipped contact sync toward completion', async () => {
        await markInterestsSelected('user-123');
        await markContactsSkipped('user-123');

        const component = await renderCard({
            navigation: buildNavigation(),
            translate,
            user: completeUser,
            themeName: 'light',
        });

        expect(component.toJSON()).toBeNull();
    });

    it('hands off to the guided flow at the first unfinished step', async () => {
        const navigation = buildNavigation();
        const component = await renderCard({
            navigation,
            translate,
            user: buildUser({ firstName: 'Zack', lastName: 'Anselm' }),
            themeName: 'light',
        });

        const [continueButton] = component.root.findAll(
            (node) => node.props?.title === 'components.profileCompletionCard.continue'
        );

        act(() => { continueButton.props.onPress(); });

        expect(navigation.navigate).toHaveBeenCalledWith('CreateProfile', {
            stage: 'interests',
            isGuidedStep: true,
        });
    });

    it('jumps straight to a step the user taps out of order', async () => {
        const navigation = buildNavigation();
        const component = await renderCard({
            navigation,
            translate,
            user: buildUser(),
            themeName: 'light',
        });

        const [contactsRow] = findByLabel(component, 'components.profileCompletionCard.steps.contacts.label');

        act(() => { contactsRow.props.onPress(); });

        expect(navigation.navigate).toHaveBeenCalledWith('CreateProfile', {
            stage: 'contacts',
            isGuidedStep: true,
        });
    });

    it('collapses the checklist to just the progress bar on demand', async () => {
        const component = await renderCard({
            navigation: buildNavigation(),
            translate,
            user: buildUser(),
            themeName: 'light',
        });

        const [collapseButton] = findByLabel(component, 'components.profileCompletionCard.collapse');
        act(() => { collapseButton.props.onPress(); });

        const tree = JSON.stringify(component.toJSON());
        expect(tree).not.toContain('components.profileCompletionCard.steps.name.label');
        // The header and progress bar survive so the card is still re-openable.
        expect(tree).toContain('components.profileCompletionCard.title');
        expect(tree).toContain('components.profileCompletionCard.expand');
    });

    it('re-reads persisted progress when the screen regains focus', async () => {
        const navigation = buildNavigation();
        await renderCard({
            navigation,
            translate,
            user: buildUser(),
            themeName: 'light',
        });

        expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });
});
