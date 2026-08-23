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

// Assert on locale keys rather than translated copy, so these stay valid when
// the wording changes.
jest.mock('../../main/utilities/translator', () => ({
    __esModule: true,
    default: (_locale: string, key: string) => key,
}));

jest.mock('../../main/components/ButtonMenu/MainButtonMenu', () => () => null);

import { AccessLevels } from 'therr-js-utilities/constants';
import { ProfileCompletion } from '../../main/routes/ProfileCompletion';
import { markContactsSkipped, markContactsSynced, markInterestsSelected } from '../../main/utilities/profileCompletion';

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

// `BaseButton` reads the theme name straight off the store via `useSelector`.
const mockStore = {
    getState: () => ({ user: { settings: { mobileThemeName: 'light' } } }),
    subscribe: () => () => {},
    dispatch: () => {},
};

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
    accessLevels: [AccessLevels.MOBILE_VERIFIED],
    media: { profilePicture: { path: 'some/path.jpeg' } },
});

const buildNavigation = () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn().mockReturnValue(jest.fn()),
});

const rendered: renderer.ReactTestRenderer[] = [];

const renderScreen = async (props: any) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <Provider store={mockStore as any}>
                <ProfileCompletion {...props} />
            </Provider>
        );
        await Promise.resolve();
    });
    rendered.push(component!);
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

// The progress bar runs a JS-driven Animated.timing on mount. Leaving trees
// mounted lets it keep firing timers past the suite, which trips Jest's
// "environment has been torn down" error.
afterEach(() => {
    act(() => {
        rendered.splice(0).forEach((component) => component.unmount());
    });
    jest.clearAllMocks();
});

describe('ProfileCompletion', () => {
    it('lists every outstanding step for a new profile', async () => {
        const component = await renderScreen({
            navigation: buildNavigation(),
            user: buildUser(),
        });

        const tree = JSON.stringify(component.toJSON());
        expect(tree).toContain('pages.profileCompletion.title');
        expect(tree).toContain('pages.profileCompletion.steps.name.label');
        expect(tree).toContain('pages.profileCompletion.steps.contacts.label');
        // 5 outstanding steps → plural copy.
        expect(tree).toContain('pages.profileCompletion.stepsLeft');
    });

    it('uses singular copy when a single step remains', async () => {
        await markInterestsSelected('user-123');
        await markContactsSynced('user-123');

        const component = await renderScreen({
            navigation: buildNavigation(),
            user: buildUser({
                firstName: 'Zack',
                lastName: 'Anselm',
                phoneNumber: '+15555555555',
                accessLevels: [AccessLevels.MOBILE_VERIFIED],
            }),
        });

        const tree = JSON.stringify(component.toJSON());
        expect(tree).toContain('pages.profileCompletion.stepLeft');
        expect(tree).not.toContain('pages.profileCompletion.stepsLeft');
    });

    it('shows the finished state once every step is resolved', async () => {
        await markInterestsSelected('user-123');
        await markContactsSynced('user-123');

        const component = await renderScreen({
            navigation: buildNavigation(),
            user: completeUser,
        });

        const tree = JSON.stringify(component.toJSON());
        expect(tree).toContain('pages.profileCompletion.allDone');
        expect(tree).not.toContain('pages.profileCompletion.steps.name.label');
    });

    it('counts a skipped contact sync toward completion', async () => {
        await markInterestsSelected('user-123');
        await markContactsSkipped('user-123');

        const component = await renderScreen({
            navigation: buildNavigation(),
            user: completeUser,
        });

        expect(JSON.stringify(component.toJSON())).toContain('pages.profileCompletion.allDone');
    });

    it('hands off to the guided flow at the first unfinished step', async () => {
        const navigation = buildNavigation();
        const component = await renderScreen({
            navigation,
            user: buildUser({ firstName: 'Zack', lastName: 'Anselm' }),
        });

        const [continueButton] = component.root.findAll(
            (node) => node.props?.title === 'pages.profileCompletion.continue'
        );

        act(() => { continueButton.props.onPress(); });

        expect(navigation.navigate).toHaveBeenCalledWith('CreateProfile', {
            stage: 'interests',
            isGuidedStep: true,
        });
    });

    it('jumps straight to a step the user taps out of order', async () => {
        const navigation = buildNavigation();
        const component = await renderScreen({
            navigation,
            user: buildUser(),
        });

        const [contactsRow] = findByLabel(component, 'pages.profileCompletion.steps.contacts.label');

        act(() => { contactsRow.props.onPress(); });

        expect(navigation.navigate).toHaveBeenCalledWith('CreateProfile', {
            stage: 'contacts',
            isGuidedStep: true,
        });
    });

    it('re-reads persisted progress when the screen regains focus', async () => {
        const navigation = buildNavigation();
        await renderScreen({
            navigation,
            user: buildUser(),
        });

        expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });
});
