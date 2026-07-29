import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, expect } from '@jest/globals';

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

import IncompleteProfileBanner from '../../main/components/IncompleteProfileBanner';

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const DISMISSED_AT_KEY = 'incompleteProfileBannerDismissedAt';

const translate = (key: string) => key;

// No first name, no picture, no phone, no flags — every step is outstanding, so
// dismissal is the only thing that can keep the banner off screen.
const incompleteUser = {
    details: {
        id: 'user-123',
        userName: 'testuser',
    },
    settings: { mobileThemeName: 'light', locale: 'en-us' },
} as any;

const buildNavigation = () => ({
    navigate: jest.fn(),
});

const renderBanner = async (props: any) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(<IncompleteProfileBanner {...props} />);
        await Promise.resolve();
    });
    return component!;
};

beforeEach(async () => {
    await AsyncStorage.clear();
});

describe('IncompleteProfileBanner', () => {
    it('renders nothing at any point for a user who dismissed it within the last 7 days', async () => {
        await AsyncStorage.setItem(DISMISSED_AT_KEY, `${Date.now()}`);

        const component = await renderBanner({
            navigation: buildNavigation(),
            translate,
            user: incompleteUser,
        });

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(component.toJSON()).toBeNull();
    });

    it('stays hidden while the dismissal read is still in flight and the flags read has already landed', async () => {
        // The regression this guards: `isReady` used to flip on the flags read
        // alone, so between the two independent mount reads the banner rendered
        // with `isDismissed` still at its initial `false` — a visible flash for
        // a user who had dismissed it.
        await AsyncStorage.setItem(DISMISSED_AT_KEY, `${Date.now()}`);

        const realGetItem = AsyncStorage.getItem;
        let releaseDismissedRead: (value: string | null) => void = () => {};
        const dismissedRead = new Promise<string | null>((resolve) => {
            releaseDismissedRead = resolve;
        });

        // Hold only the dismissal read; the profile-completion flags read
        // (a different key) resolves on its normal schedule. Swapped by hand
        // rather than with jest.spyOn — the AsyncStorage manual mock's methods
        // are already jest.fn()s, and mockRestore() on those clears the mock's
        // own implementation instead of putting it back.
        AsyncStorage.getItem = (key: any) => (
            key === DISMISSED_AT_KEY ? dismissedRead : realGetItem.call(AsyncStorage, key)
        );

        try {
            const component = await renderBanner({
                navigation: buildNavigation(),
                translate,
                user: incompleteUser,
            });

            await act(async () => {
                await Promise.resolve();
                await Promise.resolve();
                await Promise.resolve();
            });

            // Flags have resolved, dismissal has not — nothing may be on screen yet.
            expect(component.toJSON()).toBeNull();

            await act(async () => {
                releaseDismissedRead(`${Date.now()}`);
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(component.toJSON()).toBeNull();
        } finally {
            AsyncStorage.getItem = realGetItem;
        }
    });

    it('renders for a user with outstanding steps who has not dismissed it', async () => {
        const component = await renderBanner({
            navigation: buildNavigation(),
            translate,
            user: incompleteUser,
        });

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(component.toJSON()).not.toBeNull();
    });

    it('renders again once the 7 day dismissal window has elapsed', async () => {
        const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
        await AsyncStorage.setItem(DISMISSED_AT_KEY, `${eightDaysAgo}`);

        const component = await renderBanner({
            navigation: buildNavigation(),
            translate,
            user: incompleteUser,
        });

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(component.toJSON()).not.toBeNull();
    });
});
