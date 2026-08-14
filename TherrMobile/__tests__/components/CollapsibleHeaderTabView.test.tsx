import 'react-native';
import React from 'react';
import { Text, View } from 'react-native';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach, jest } from '@jest/globals';

import CollapsibleHeaderTabView, {
    HEADER_TEST_ID,
    ICollapsibleSceneProps,
    TAB_BAR_TEST_ID,
    getSceneContentContainerStyle,
    getSyncTargetOffset,
    shouldSyncListOffset,
} from '../../main/components/CollapsibleHeaderTabView';

/**
 * Collapsible profile header tests.
 *
 * The header on ViewUser is an absolutely positioned overlay that translates up as
 * the active tab's list scrolls. Three invariants keep that from stranding the user,
 * and all three are pure geometry, so they are pinned here rather than left to a
 * device build:
 *
 *  - Every list must be padded past the overlay, or its first item renders behind
 *    the profile photo.
 *  - Every list must be able to scroll at least a full header's worth. Without the
 *    `minHeight` floor, a tab holding one item (or an empty state) cannot scroll,
 *    so a header collapsed on a busy tab can never be reopened from a quiet one.
 *  - Switching tabs must not make the header jump, which means inactive lists get
 *    re-synced — but only when moving them actually changes what the header shows.
 */

const HEADER_HEIGHT = 320;
const TAB_BAR_HEIGHT = 48;
const CONTAINER_HEIGHT = 600;

describe('getSceneContentContainerStyle', () => {
    it('should offset list content past the header and tab bar overlay', () => {
        const style = getSceneContentContainerStyle({
            containerHeight: CONTAINER_HEIGHT,
            headerHeight: HEADER_HEIGHT,
            tabBarHeight: TAB_BAR_HEIGHT,
        });

        expect(style.paddingTop).toBe(HEADER_HEIGHT + TAB_BAR_HEIGHT);
    });

    it('should always leave enough scroll range to fully collapse the header', () => {
        [0, 1, 40, CONTAINER_HEIGHT * 4].forEach((naturalContentHeight) => {
            const style = getSceneContentContainerStyle({
                containerHeight: CONTAINER_HEIGHT,
                headerHeight: HEADER_HEIGHT,
                tabBarHeight: TAB_BAR_HEIGHT,
            });
            const contentHeight = Math.max(style.minHeight as number, naturalContentHeight);
            const scrollRange = contentHeight - CONTAINER_HEIGHT;

            expect(scrollRange).toBeGreaterThanOrEqual(HEADER_HEIGHT);
        });
    });

    it('should keep the bottom inset inside the content box so it adds no extra scroll range', () => {
        const withInset = getSceneContentContainerStyle({
            containerHeight: CONTAINER_HEIGHT,
            headerHeight: HEADER_HEIGHT,
            tabBarHeight: TAB_BAR_HEIGHT,
            bottomInset: 64,
        });
        const withoutInset = getSceneContentContainerStyle({
            containerHeight: CONTAINER_HEIGHT,
            headerHeight: HEADER_HEIGHT,
            tabBarHeight: TAB_BAR_HEIGHT,
        });

        expect(withInset.paddingBottom).toBe(64);
        expect(withInset.minHeight).toBe(withoutInset.minHeight);
    });

    it('should stay benign before anything has been measured', () => {
        const style = getSceneContentContainerStyle({
            containerHeight: 0,
            headerHeight: 0,
            tabBarHeight: 0,
        });

        expect(style.paddingTop).toBe(0);
        expect(style.minHeight).toBe(0);
    });
});

describe('getSyncTargetOffset', () => {
    it('should mirror the active tab while the header is still collapsing', () => {
        expect(getSyncTargetOffset(120, HEADER_HEIGHT)).toBe(120);
    });

    it('should cap at the collapse point once the header is fully hidden', () => {
        expect(getSyncTargetOffset(5000, HEADER_HEIGHT)).toBe(HEADER_HEIGHT);
    });

    it('should ignore overscroll bounce above the top of the list', () => {
        expect(getSyncTargetOffset(-80, HEADER_HEIGHT)).toBe(0);
    });
});

describe('shouldSyncListOffset', () => {
    it('should pull an untouched tab down to the collapsed position', () => {
        expect(shouldSyncListOffset(0, HEADER_HEIGHT, HEADER_HEIGHT)).toBe(true);
    });

    it('should leave a tab that is already scrolled deeper where the user left it', () => {
        expect(shouldSyncListOffset(2400, HEADER_HEIGHT, HEADER_HEIGHT)).toBe(false);
    });

    it('should reopen the header on other tabs when the active tab returns to the top', () => {
        expect(shouldSyncListOffset(2400, 0, HEADER_HEIGHT)).toBe(true);
    });

    it('should not churn on sub-pixel differences', () => {
        expect(shouldSyncListOffset(119.6, 120, HEADER_HEIGHT)).toBe(false);
    });

    it('should do nothing before the header has been measured', () => {
        expect(shouldSyncListOffset(0, 0, 0)).toBe(false);
    });
});

describe('CollapsibleHeaderTabView', () => {
    const routes = [
        { key: 'moments', title: 'Moments' },
        { key: 'thoughts', title: 'Thoughts' },
    ];

    const mounted: any[] = [];

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        // The pager keeps Animated listeners and a deferred scene mount alive; leaving
        // trees mounted leaks them into the rest of the suite.
        act(() => {
            mounted.splice(0).forEach((tree) => tree.unmount());
        });
        jest.clearAllTimers();
    });

    const renderTabView = () => {
        const sceneProps: { [key: string]: ICollapsibleSceneProps } = {};
        let tree: any;

        act(() => {
            tree = renderer.create(
                <CollapsibleHeaderTabView
                    navigationState={{ index: 0, routes }}
                    onIndexChange={() => {}}
                    initialLayout={{ width: 400 }}
                    listBottomInset={64}
                    renderHeader={() => <Text>Profile</Text>}
                    renderTabBar={() => <View />}
                    renderScene={({ route, collapsible }) => {
                        sceneProps[route.key] = collapsible;
                        return <View />;
                    }}
                />,
            );
        });

        mounted.push(tree);

        // Unfocused scenes mount on a deferred tick; flush it so every tab is present.
        act(() => {
            jest.runAllTimers();
        });

        const measure = (testID: string, height: number) => act(() => {
            tree.root.findByProps({ testID }).props.onLayout({
                nativeEvent: { layout: { height, width: 400, x: 0, y: 0 } },
            });
        });

        return { tree, sceneProps, measure };
    };

    it('should hand every scene the props it needs to drive the header', () => {
        const { sceneProps } = renderTabView();

        routes.forEach(({ key }) => {
            expect(sceneProps[key]).toBeDefined();
            // A native-driven Animated.event is an AnimatedEvent object, not a plain
            // handler — it has to reach the list intact for the header to move off-thread.
            expect(sceneProps[key].onScroll).toBeDefined();
            expect(typeof sceneProps[key].onScroll.__getHandler).toBe('function');
            expect(typeof sceneProps[key].registerRef).toBe('function');
            expect(sceneProps[key].scrollEventThrottle).toBe(16);
        });
    });

    it('should give each tab its own scroll event, since one cannot be attached natively twice', () => {
        const { sceneProps } = renderTabView();

        expect(sceneProps.moments.onScroll).not.toBe(sceneProps.thoughts.onScroll);
    });

    it('should push list content below the header once the overlay has been measured', () => {
        const { sceneProps, measure } = renderTabView();

        expect(sceneProps.moments.contentContainerStyle.paddingTop).toBe(48);

        measure(HEADER_TEST_ID, 320);
        measure(TAB_BAR_TEST_ID, 44);

        expect(sceneProps.moments.contentContainerStyle.paddingTop).toBe(364);
        expect(sceneProps.moments.progressViewOffset).toBe(364);
        expect(sceneProps.thoughts.contentContainerStyle.paddingTop).toBe(364);
    });

    it('should keep the header and tab bar out of the pager flow so scenes fill the screen', () => {
        const { tree } = renderTabView();

        const header = tree.root.findByProps({ testID: HEADER_TEST_ID });
        const tabBar = tree.root.findByProps({ testID: TAB_BAR_TEST_ID });

        const flatten = (style: any) => (Array.isArray(style) ? Object.assign({}, ...style.flat()) : style);

        expect(flatten(header.props.style).position).toBe('absolute');
        expect(flatten(tabBar.props.style).position).toBe('absolute');
    });

    it('should pin the tab bar directly beneath the header', () => {
        const { tree, measure } = renderTabView();

        measure(HEADER_TEST_ID, 320);

        const tabBar = tree.root.findByProps({ testID: TAB_BAR_TEST_ID });
        const flattened = Object.assign({}, ...tabBar.props.style.flat());

        expect(flattened.top).toBe(320);
    });
});
