/**
 * @jest-environment jsdom
 */
import 'react-native';
import React from 'react';
import { Text, View } from 'react-native';
import {
    NavigationContainer,
    StackRouter,
    createNavigationContainerRef,
    createNavigatorFactory,
    useNavigationBuilder,
} from '@react-navigation/native';
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Locale Remount Navigation State Regression Tests
 *
 * `Layout.tsx` keys its `NavigationContainer` on the active locale so that every route
 * remounts and re-runs its translator when the language changes. Left alone, that remount
 * drops the navigation state and the user is dumped back on the navigator's first screen —
 * which is how changing the language from the sign-up screen used to bounce people out to
 * the landing/sign-in screen.
 *
 * The fix mirrors the latest root state and feeds it back as `initialState` on remount.
 * These tests pin both halves of that contract: the remount happens, and the stack survives it.
 */

/**
 * A bare-bones stack navigator built on the same `StackRouter` the app's native stack uses.
 * Going through `@react-navigation/native-stack` would drag in the native screen/header views,
 * which don't render under Jest — and the behavior under test lives entirely in the router and
 * the container, not in the presentation layer.
 */
const MinimalStackNavigator = ({ initialRouteName, children, screenOptions }: any) => {
    const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, {
        initialRouteName,
        children,
        screenOptions,
    });

    return (
        <NavigationContent>
            <View>{descriptors[state.routes[state.index].key].render()}</View>
        </NavigationContent>
    );
};

const Stack = createNavigatorFactory(MinimalStackNavigator)();

const LandingScreen = () => <Text>Landing</Text>;
const LoginScreen = () => <Text>Login</Text>;
const RegisterScreen = () => <Text>Register</Text>;

interface ITestNavProps {
    locale: string;
    navigationRef: any;
    // Mirrors Layout's `lastNavigationState` instance field.
    stateRef: { current: any };
    preserveState: boolean;
}

const TestNav = ({
    locale, navigationRef, stateRef, preserveState,
}: ITestNavProps) => (
    <NavigationContainer
        key={locale}
        initialState={preserveState ? stateRef.current : undefined}
        ref={navigationRef}
        onReady={() => {
            stateRef.current = navigationRef?.getRootState();
        }}
        onStateChange={() => {
            stateRef.current = navigationRef?.getRootState();
        }}
    >
        <Stack.Navigator>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
    </NavigationContainer>
);

describe('locale-keyed NavigationContainer remount', () => {
    let navigationRef: any;
    let stateRef: { current: any };

    beforeEach(() => {
        navigationRef = createNavigationContainerRef();
        stateRef = { current: undefined };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const renderNav = async (locale: string, preserveState: boolean) => {
        let component: renderer.ReactTestRenderer;
        await act(async () => {
            component = renderer.create(
                <TestNav
                    locale={locale}
                    navigationRef={navigationRef}
                    stateRef={stateRef}
                    preserveState={preserveState}
                />
            );
        });

        return component!;
    };

    const navigateTo = async (routeName: string) => {
        await act(async () => {
            navigationRef.navigate(routeName);
        });
    };

    const changeLocale = async (component: renderer.ReactTestRenderer, locale: string, preserveState: boolean) => {
        await act(async () => {
            component.update(
                <TestNav
                    locale={locale}
                    navigationRef={navigationRef}
                    stateRef={stateRef}
                    preserveState={preserveState}
                />
            );
        });
    };

    it('keeps the user on the sign-up screen when the locale changes', async () => {
        const component = await renderNav('en-us', true);
        await navigateTo('Register');
        expect(navigationRef.getCurrentRoute()?.name).toBe('Register');

        await changeLocale(component, 'es', true);

        expect(navigationRef.getCurrentRoute()?.name).toBe('Register');
    });

    it('preserves the back stack so the user can still return to earlier screens', async () => {
        const component = await renderNav('en-us', true);
        await navigateTo('Login');
        await navigateTo('Register');

        await changeLocale(component, 'fr-ca', true);

        expect(navigationRef.getRootState()?.routes.map((route: any) => route.name))
            .toEqual(['Landing', 'Login', 'Register']);
    });

    it('remounts every route on locale change so stale translations cannot survive', async () => {
        const component = await renderNav('en-us', true);
        await navigateTo('Register');
        const keyBeforeChange = navigationRef.getRootState()?.key;

        await changeLocale(component, 'es', true);

        expect(navigationRef.getRootState()?.key).not.toBe(keyBeforeChange);
    });

    it('falls back to the first screen without state preservation (the bug being fixed)', async () => {
        const component = await renderNav('en-us', false);
        await navigateTo('Register');

        await changeLocale(component, 'es', false);

        expect(navigationRef.getCurrentRoute()?.name).toBe('Landing');
    });
});
