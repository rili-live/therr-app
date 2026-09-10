import 'react-native';
import React from 'react';

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

import { AccessLevels } from 'therr-js-utilities/constants';
import ProfileCompletionLink from '../../main/components/ProfileCompletionLink';
import { markContactsSkipped, markContactsSynced, markInterestsSelected } from '../../main/utilities/profileCompletion';

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

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
    accessLevels: [AccessLevels.MOBILE_VERIFIED],
    media: { profilePicture: { path: 'some/path.jpeg' } },
});

const buildNavigation = () => ({
    navigate: jest.fn(),
    addListener: jest.fn().mockReturnValue(jest.fn()),
});

const rendered: renderer.ReactTestRenderer[] = [];

const renderLink = async (props: any) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(<ProfileCompletionLink {...props} />);
        await Promise.resolve();
    });
    rendered.push(component!);
    return component!;
};

beforeEach(async () => {
    await AsyncStorage.clear();
});

afterEach(() => {
    act(() => {
        rendered.splice(0).forEach((component) => component.unmount());
    });
    jest.clearAllMocks();
});

describe('ProfileCompletionLink', () => {
    it('summarizes the remaining work without listing the steps', async () => {
        const component = await renderLink({
            navigation: buildNavigation(),
            translate,
            user: buildUser(),
            themeName: 'light',
        });

        const tree = JSON.stringify(component.toJSON());
        expect(tree).toContain('components.profileCompletionLink.title');
        // 5 outstanding steps → plural copy.
        expect(tree).toContain('components.profileCompletionLink.stepsLeft');
        // The checklist belongs to the dedicated screen, not to this row.
        expect(tree).not.toContain('pages.profileCompletion.steps.name.label');
    });

    it('uses singular copy when a single step remains', async () => {
        await markInterestsSelected('user-123');
        await markContactsSynced('user-123');

        const component = await renderLink({
            navigation: buildNavigation(),
            translate,
            user: buildUser({
                firstName: 'Zack',
                lastName: 'Anselm',
                phoneNumber: '+15555555555',
                accessLevels: [AccessLevels.MOBILE_VERIFIED],
            }),
            themeName: 'light',
        });

        const tree = JSON.stringify(component.toJSON());
        expect(tree).toContain('components.profileCompletionLink.stepLeft');
        expect(tree).not.toContain('components.profileCompletionLink.stepsLeft');
    });

    it('renders nothing once every step is resolved', async () => {
        await markInterestsSelected('user-123');
        await markContactsSynced('user-123');

        const component = await renderLink({
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

        const component = await renderLink({
            navigation: buildNavigation(),
            translate,
            user: completeUser,
            themeName: 'light',
        });

        expect(component.toJSON()).toBeNull();
    });

    it('navigates to the dedicated checklist screen', async () => {
        const navigation = buildNavigation();
        const component = await renderLink({
            navigation,
            translate,
            user: buildUser(),
            themeName: 'light',
        });

        // Pressable renders a host View that carries the label but not the
        // handler, so match on the composite node that owns onPress.
        const [row] = component.root.findAll((node) => typeof node.props?.onPress === 'function'
            && typeof node.props?.accessibilityLabel === 'string');

        act(() => { row.props.onPress(); });

        expect(navigation.navigate).toHaveBeenCalledWith('ProfileCompletion');
    });

    it('re-reads persisted progress when the profile regains focus', async () => {
        const navigation = buildNavigation();
        await renderLink({
            navigation,
            translate,
            user: buildUser(),
            themeName: 'light',
        });

        expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });
});
