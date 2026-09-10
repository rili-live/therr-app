import 'react-native';
import React from 'react';
import { Modal } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { it, describe, expect, jest } from '@jest/globals';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

/**
 * The drawer opens inside a `Modal`, which under Android's enforced edge-to-edge draws
 * behind the status bar and the display cutout. Its header (avatar, username, close) then
 * lands underneath the clock and the camera hole-punch — the bug this file guards against.
 * The animation itself is irrelevant to that, so reanimated is stubbed out to plain views.
 */
jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    const AnimatedStub: any = {
        View,
        // react-native-gesture-handler reaches for this at import time.
        createAnimatedComponent: (Component: any) => Component,
    };

    return {
        __esModule: true,
        default: AnimatedStub,
        useSharedValue: (value: number) => ({ value }),
        useAnimatedStyle: (factory: any) => factory(),
        withTiming: (toValue: number) => toValue,
        runOnJS: (fn: any) => fn,
        Easing: {
            in: () => undefined,
            out: () => undefined,
            cubic: undefined,
        },
    };
});

// `main/constants` pulls in notifee, which reaches for its native module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: { createChannel: jest.fn() },
    AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
    AndroidVisibility: { PUBLIC: 1 },
}));

import { DrawerOverlay } from '../../main/components/HeaderMenuRight';

const flatten = (style: any): any => {
    if (Array.isArray(style)) {
        return style.reduce((acc, entry) => ({ ...acc, ...flatten(entry) }), {});
    }
    return style || {};
};

const renderDrawer = async (insets: { top: number; bottom: number } | null) => {
    let component: any;

    await act(async () => {
        component = renderer.create(
            <SafeAreaInsetsContext.Provider value={insets as any}>
                <DrawerOverlay
                    isOpen={true}
                    onRequestClose={() => {}}
                    overlayStyle={{ flex: 1 }}
                    drawerContainerStyle={{ width: '75%' }}
                    drawerBodyStyle={{ flex: 1 }}
                >
                    {null}
                </DrawerOverlay>
            </SafeAreaInsetsContext.Provider>
        );
    });

    return component;
};

const getDrawerContainerStyle = (component: any) => {
    const modal = component.root.findByType(Modal);
    // The drawer panel is the only descendant carrying the container width.
    const container = modal.findAll(
        (node: any) => flatten(node.props?.style).width === '75%',
        { deep: true }
    )[0];

    return flatten(container.props.style);
};

describe('HeaderMenuRight drawer overlay', () => {
    it('pads the drawer by the measured safe-area insets so its header clears the cutout', async () => {
        const component = await renderDrawer({ top: 48, bottom: 24 });
        const style = getDrawerContainerStyle(component);

        expect(style.paddingTop).toBe(48);
        expect(style.paddingBottom).toBe(24);
    });

    it('falls back to a non-zero top inset when the provider has not measured yet', async () => {
        const component = await renderDrawer(null);
        const style = getDrawerContainerStyle(component);

        expect(style.paddingTop).toBeGreaterThan(0);
    });

    it('renders the modal window edge-to-edge so the inset padding is applied exactly once', async () => {
        const component = await renderDrawer({ top: 48, bottom: 24 });
        const modal = component.root.findByType(Modal);

        expect(modal.props.statusBarTranslucent).toBe(true);
        expect(modal.props.navigationBarTranslucent).toBe(true);
    });
});
