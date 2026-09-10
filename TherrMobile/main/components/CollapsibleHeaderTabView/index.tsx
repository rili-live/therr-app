import React from 'react';
import {
    Animated,
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { TabView } from 'react-native-tab-view';

/**
 * Fallback height used for the first render pass, before the real tab bar reports
 * its measured height. Matches the default react-native-tab-view TabBar height so
 * the very first frame is never visibly wrong.
 */
const DEFAULT_TAB_BAR_HEIGHT = 48;

export const HEADER_TEST_ID = 'collapsible-header';
export const TAB_BAR_TEST_ID = 'collapsible-tab-bar';

/**
 * Scroll props that a scene MUST spread onto its scrollable list for the header
 * to collapse. Everything the scene needs is bundled here so a scene stays a
 * one-liner and none of the offsets have to be recomputed by callers.
 */
export interface ICollapsibleSceneProps {
    /** Animated list component. Native-driven onScroll requires an Animated host. */
    ScrollComponent: React.ComponentType<any>;
    /** Leaves room for the header + tab bar overlay, and guarantees the list can scroll far enough to collapse. */
    contentContainerStyle: ViewStyle;
    /** A native-driven Animated.event instance, not a plain handler. */
    onScroll: any;
    onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange: (width: number, height: number) => void;
    scrollEventThrottle: number;
    scrollIndicatorInsets: { top: number };
    /** Pass to RefreshControl so the spinner drops below the header instead of behind it. */
    progressViewOffset: number;
    /** Pass as the list `ref` so tab switches can keep every list in sync with the header. */
    registerRef: (ref: any) => void;
}

interface ICollapsibleHeaderTabViewProps {
    /** Style for the header overlay. MUST include an opaque backgroundColor — list content scrolls beneath it. */
    headerStyle?: StyleProp<ViewStyle>;
    initialLayout?: { width?: number; height?: number };
    lazy?: boolean;
    lazyPreloadDistance?: number;
    /** Extra bottom padding for every list (e.g. to clear a bottom button menu). */
    listBottomInset?: number;
    navigationState: { index: number; routes: any[] };
    onIndexChange: (index: number) => void;
    onLayout?: (event: LayoutChangeEvent) => void;
    renderHeader: () => React.ReactNode;
    renderLazyPlaceholder?: (props: { route: any }) => React.ReactElement | null;
    renderScene: (props: { route: any; collapsible: ICollapsibleSceneProps }) => React.ReactNode;
    renderTabBar: (props: any) => React.ReactElement | null;
    style?: StyleProp<ViewStyle>;
}

/**
 * Content padding/min-height for a scene's list.
 *
 * `paddingTop` clears the overlay (header + tab bar). `minHeight` guarantees the
 * list can always scroll at least a full header's worth, so a tab holding one item
 * — or none — can never strand the header in a collapsed state with no way to
 * scroll back up and reopen it.
 */
export const getSceneContentContainerStyle = ({
    containerHeight,
    headerHeight,
    tabBarHeight,
    bottomInset = 0,
}: {
    containerHeight: number;
    headerHeight: number;
    tabBarHeight: number;
    bottomInset?: number;
}): ViewStyle => ({
    paddingTop: headerHeight + tabBarHeight,
    paddingBottom: bottomInset,
    minHeight: containerHeight + headerHeight,
});

/** Offset an inactive tab should sit at to agree with the header's current position. */
export const getSyncTargetOffset = (activeOffset: number, collapsibleHeight: number): number => Math
    .max(0, Math.min(activeOffset, collapsibleHeight));

/**
 * Whether an inactive tab actually has to be moved. Lists already scrolled past the
 * collapse point are left alone — the header reads identically either way, and
 * yanking them back would lose the user's place in that tab.
 */
export const shouldSyncListOffset = (
    listOffset: number,
    targetOffset: number,
    collapsibleHeight: number,
): boolean => {
    if (collapsibleHeight <= 0) {
        return false;
    }
    if (targetOffset >= collapsibleHeight && listOffset >= collapsibleHeight) {
        return false;
    }
    return Math.abs(listOffset - targetOffset) >= 1;
};

const scrollListToOffset = (ref: any, offset: number) => {
    if (!ref) {
        return;
    }
    if (typeof ref.scrollToOffset === 'function') {
        ref.scrollToOffset({ offset, animated: false });
    } else if (typeof ref.scrollTo === 'function') {
        ref.scrollTo({ y: offset, animated: false });
    }
};

/**
 * A TabView whose scenes scroll underneath a profile-style header that collapses
 * as the user scrolls down and expands again when they return to the top.
 *
 * How it works (the parts that are easy to get wrong):
 *
 * 1. The header and the tab bar are absolutely positioned OVER the TabView rather
 *    than stacked above it in flow. If they stayed in flow, translating them up
 *    would also translate the list, and content would appear to scroll at double
 *    speed while the header collapsed.
 * 2. The tab bar is still rendered BY the TabView (through `renderTabBar`), just
 *    wrapped in an absolutely positioned Animated.View. That keeps the indicator
 *    driven by the pager's `position` value, so it still tracks swipes, while the
 *    wrapper takes it out of flow and pins it directly beneath the header.
 * 3. Every list is offset by `paddingTop`, so nothing starts underneath the
 *    overlay, and carries a `minHeight` that guarantees at least a full header of
 *    scroll range — otherwise a short list could leave the header stuck collapsed
 *    with no way to scroll back up.
 * 4. `scrollY` is shared by every tab and driven natively (no JS per frame). Tab
 *    scroll positions are re-synced when scrolling stops, so switching tabs never
 *    makes the header jump.
 */
const CollapsibleHeaderTabView = ({
    headerStyle,
    initialLayout,
    lazy,
    lazyPreloadDistance,
    listBottomInset = 0,
    navigationState,
    onIndexChange,
    onLayout,
    renderHeader,
    renderLazyPlaceholder,
    renderScene,
    renderTabBar,
    style,
}: ICollapsibleHeaderTabViewProps) => {
    const [headerHeight, setHeaderHeight] = React.useState(0);
    const [tabBarHeight, setTabBarHeight] = React.useState(DEFAULT_TAB_BAR_HEIGHT);
    const [containerHeight, setContainerHeight] = React.useState(0);

    const scrollY = React.useRef(new Animated.Value(0)).current;
    const listRefs = React.useRef<{ [key: string]: any }>({});
    const listOffsets = React.useRef<{ [key: string]: number }>({});
    // Offsets that could not be applied yet because the list had not laid out its
    // content. Flushed on the next content-size change.
    const pendingOffsets = React.useRef<{ [key: string]: number }>({});
    const collapsibleHeightRef = React.useRef(0);
    const activeRouteKeyRef = React.useRef<string | undefined>(navigationState.routes[navigationState.index]?.key);

    React.useEffect(() => {
        collapsibleHeightRef.current = headerHeight;
    }, [headerHeight]);

    React.useEffect(() => {
        activeRouteKeyRef.current = navigationState.routes[navigationState.index]?.key;
    }, [navigationState]);

    const applyOffset = React.useCallback((routeKey: string, offset: number) => {
        const ref = listRefs.current[routeKey];
        if (!ref) {
            pendingOffsets.current[routeKey] = offset;
            return;
        }
        scrollListToOffset(ref, offset);
        listOffsets.current[routeKey] = offset;
    }, []);

    /**
     * Keep the inactive tabs aligned with the header. Without this, swiping to a
     * tab parked at a different offset would snap the header as soon as that list
     * emitted its first scroll event.
     */
    const syncInactiveLists = React.useCallback((activeRouteKey: string, activeOffset: number) => {
        const collapsibleHeight = collapsibleHeightRef.current;
        if (collapsibleHeight <= 0) {
            return;
        }
        const target = getSyncTargetOffset(activeOffset, collapsibleHeight);

        Object.keys(listRefs.current).forEach((routeKey) => {
            if (routeKey === activeRouteKey) {
                return;
            }
            const offset = listOffsets.current[routeKey] || 0;
            if (shouldSyncListOffset(offset, target, collapsibleHeight)) {
                applyOffset(routeKey, target);
            }
        });
    }, [applyOffset]);

    /**
     * One Animated.event per tab, all writing into the same `scrollY`.
     * They cannot be shared: an AnimatedEvent tracks a single native attachment,
     * so reusing one instance across lists would leave the first list's handler
     * dangling and detach the wrong one on unmount.
     */
    const scrollEvents = React.useRef<{ [key: string]: any }>({});
    const getScrollEvent = React.useCallback((routeKey: string) => {
        if (!scrollEvents.current[routeKey]) {
            scrollEvents.current[routeKey] = Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true },
            );
        }
        return scrollEvents.current[routeKey];
    }, [scrollY]);

    const handleScrollEnd = React.useCallback((
        routeKey: string,
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        const offset = event.nativeEvent.contentOffset.y;
        listOffsets.current[routeKey] = offset;
        if (routeKey === activeRouteKeyRef.current) {
            syncInactiveLists(routeKey, offset);
        }
    }, [syncInactiveLists]);

    const handleRegisterRef = React.useCallback((routeKey: string, ref: any) => {
        if (!ref) {
            delete listRefs.current[routeKey];
            return;
        }
        listRefs.current[routeKey] = ref;

        // A tab mounted lazily while the header is already collapsed starts at zero.
        // Align it with the header (it may have to wait for content to lay out).
        const activeKey = activeRouteKeyRef.current;
        const activeOffset = activeKey ? (listOffsets.current[activeKey] || 0) : 0;
        const target = Math.max(0, Math.min(activeOffset, collapsibleHeightRef.current));
        if (target > 0 && (listOffsets.current[routeKey] || 0) < target) {
            pendingOffsets.current[routeKey] = target;
        }
    }, []);

    const handleContentSizeChange = React.useCallback((routeKey: string) => {
        const pending = pendingOffsets.current[routeKey];
        if (pending == null) {
            return;
        }
        delete pendingOffsets.current[routeKey];
        applyOffset(routeKey, pending);
    }, [applyOffset]);

    const handleContainerLayout = React.useCallback((event: LayoutChangeEvent) => {
        const { height } = event.nativeEvent.layout;
        setContainerHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
        onLayout?.(event);
    }, [onLayout]);

    const handleHeaderLayout = React.useCallback((event: LayoutChangeEvent) => {
        const { height } = event.nativeEvent.layout;
        setHeaderHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
    }, []);

    const handleTabBarLayout = React.useCallback((event: LayoutChangeEvent) => {
        const { height } = event.nativeEvent.layout;
        if (height <= 0) {
            return;
        }
        setTabBarHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
    }, []);

    const headerTranslateY: any = React.useMemo(() => {
        if (headerHeight <= 0) {
            return 0;
        }
        return scrollY.interpolate({
            inputRange: [0, headerHeight],
            outputRange: [0, -headerHeight],
            extrapolate: 'clamp',
        });
    }, [headerHeight, scrollY]);

    const overlayHeight = headerHeight + tabBarHeight;

    const sceneContentContainerStyle = React.useMemo(() => getSceneContentContainerStyle({
        containerHeight,
        headerHeight,
        tabBarHeight,
        bottomInset: listBottomInset,
    }), [containerHeight, headerHeight, tabBarHeight, listBottomInset]);

    const collapsiblePropsByKey = React.useMemo(() => {
        const propsByKey: { [key: string]: ICollapsibleSceneProps } = {};
        navigationState.routes.forEach((route) => {
            const routeKey = route.key;
            propsByKey[routeKey] = {
                ScrollComponent: Animated.FlatList as any,
                contentContainerStyle: sceneContentContainerStyle,
                onScroll: getScrollEvent(routeKey),
                onScrollEndDrag: (event) => handleScrollEnd(routeKey, event),
                onMomentumScrollEnd: (event) => handleScrollEnd(routeKey, event),
                onContentSizeChange: () => handleContentSizeChange(routeKey),
                scrollEventThrottle: 16,
                scrollIndicatorInsets: { top: overlayHeight },
                progressViewOffset: overlayHeight,
                registerRef: (ref: any) => handleRegisterRef(routeKey, ref),
            };
        });
        return propsByKey;
    }, [
        navigationState.routes,
        sceneContentContainerStyle,
        getScrollEvent,
        overlayHeight,
        handleScrollEnd,
        handleContentSizeChange,
        handleRegisterRef,
    ]);

    const renderSceneWithCollapsible = React.useCallback(({ route }: any) => renderScene({
        route,
        collapsible: collapsiblePropsByKey[route.key],
    }), [renderScene, collapsiblePropsByKey]);

    // Placeholders are not scrollable, so they need the header offset applied directly.
    const renderLazyPlaceholderOffset = React.useCallback((props: { route: any }) => (
        <View style={{ paddingTop: overlayHeight }}>
            {renderLazyPlaceholder?.(props)}
        </View>
    ), [renderLazyPlaceholder, overlayHeight]);

    /**
     * Absolutely positioned so the pager fills the whole TabView; it still gets every
     * prop the TabView would normally hand the tab bar, indicator animation included.
     */
    const renderTabBarOverlay = React.useCallback((props: any) => (
        <Animated.View
            testID={TAB_BAR_TEST_ID}
            onLayout={handleTabBarLayout}
            style={[
                styles.tabBarOverlay,
                { top: headerHeight, transform: [{ translateY: headerTranslateY }] },
            ]}
        >
            {renderTabBar(props)}
        </Animated.View>
    ), [renderTabBar, handleTabBarLayout, headerHeight, headerTranslateY]);

    return (
        <View style={[styles.container, style]} onLayout={handleContainerLayout}>
            <TabView
                lazy={lazy}
                lazyPreloadDistance={lazyPreloadDistance}
                navigationState={navigationState}
                onIndexChange={onIndexChange}
                renderLazyPlaceholder={renderLazyPlaceholder ? renderLazyPlaceholderOffset : undefined}
                renderScene={renderSceneWithCollapsible}
                renderTabBar={renderTabBarOverlay}
                initialLayout={initialLayout}
                style={styles.container}
            />
            <Animated.View
                testID={HEADER_TEST_ID}
                onLayout={handleHeaderLayout}
                style={[
                    styles.headerOverlay,
                    headerStyle,
                    { transform: [{ translateY: headerTranslateY }] },
                ]}
            >
                {renderHeader()}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        // Keeps the collapsed header from spilling out over the navigation header.
        overflow: 'hidden',
    },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        // Above the tab bar overlay, which is itself above the scenes. No elevation —
        // that would draw an Android shadow the flat header never had.
        zIndex: 2,
    },
    tabBarOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        // The tab bar is rendered before the pager in the TabView's own tree, so it
        // needs to be lifted explicitly to sit above the scenes.
        zIndex: 1,
    },
});

export default CollapsibleHeaderTabView;
