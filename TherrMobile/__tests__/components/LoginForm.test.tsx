import 'react-native';
import React from 'react';
import { ErrorCodes } from 'therr-js-utilities/constants';
import LoginForm from '../../main/routes/Login/LoginForm';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shiped with jest.
import {it, expect} from '@jest/globals';

// The shared Button reads the active theme via useSelector. This test renders
// the form with explicit props (no <Provider>), so stub useSelector to resolve
// against a default state instead of requiring a store.
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: (selector: (state: any) => any) => selector({ user: { settings: {} } }),
}));

// The form reads remembered profiles on mount. Stub the module so the test does not
// depend on device storage and so each case controls its own pre-fill.
jest.mock('../../main/utilities/rememberedProfiles', () => ({
    getRememberedProfiles: jest.fn(() => Promise.resolve([])),
    rememberCurrentUser: jest.fn(() => Promise.resolve()),
    forgetProfile: jest.fn(() => Promise.resolve([])),
}));

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

const mockStyles = {
    placeholderText: {
        color: 'white',
    },
};

// `await act(async ...)` so the remembered-profiles read that fires on mount settles
// before assertions — otherwise React warns about an unwrapped state update.
const renderLoginForm = async (props: any = {}) => {
    let component!: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <LoginForm navigation={{ navigate: jest.fn() }}
                login={jest.fn()}
                loginWithPhone={jest.fn()}
                selectPhoneLoginAccount={jest.fn()}
                userSettings={{ mobileThemeName: 'retro' }}
                themeAuthForm={{ styles: mockStyles }}
                themeAlerts={{ styles: mockStyles, colors: {} as any }}
                themeForms={{ styles: mockStyles, colors: {} as any }}
                {...props}
            />
        );
    });

    return component;
};

describe('LoginForm', () => {
    it('renders correctly', async () => {
        const component = await renderLoginForm();

        expect(component.getInstance()).toBeTruthy();
    });

    it('starts on the password step for an email identifier', async () => {
        const component = await renderLoginForm({ prefillIdentifier: 'jane@example.com' });
        const instance: any = component.getInstance();

        expect(instance.isPhoneModeActive()).toEqual(false);
        expect(component.root.findAllByProps({ testID: 'login-password' }).length).toBeGreaterThan(0);
    });

    it('switches to the SMS step when the identifier is a phone number', async () => {
        const component = await renderLoginForm({ prefillIdentifier: '+13175551234' });
        const instance: any = component.getInstance();

        expect(instance.isPhoneModeActive()).toEqual(true);
        // The password field is replaced by the "text me a code" action.
        expect(component.root.findAllByProps({ testID: 'login-password' }).length).toEqual(0);
    });

    it('pre-fills the identifier when it arrives after mount', async () => {
        // Login is never unmounted while Register sits above it in the stack, so the number a
        // phone-first sign-up hands back arrives as a prop change, not a fresh constructor.
        // Reading it only in the constructor silently dropped it.
        const component = await renderLoginForm();
        const instance: any = component.getInstance();

        expect(instance.state.inputs.userName).toEqual(undefined);

        await act(async () => {
            component.update(
                <LoginForm navigation={{ navigate: jest.fn() }}
                    login={jest.fn()}
                    loginWithPhone={jest.fn()}
                    selectPhoneLoginAccount={jest.fn()}
                    userSettings={{ mobileThemeName: 'retro' }}
                    themeAuthForm={{ styles: mockStyles }}
                    themeAlerts={{ styles: mockStyles, colors: {} as any }}
                    themeForms={{ styles: mockStyles, colors: {} as any }}
                    prefillIdentifier="+13175551234"
                />
            );
        });

        expect(instance.state.inputs.userName).toEqual('+13175551234');
        // A verified number should land straight in SMS mode, one tap from a code.
        expect(instance.isPhoneModeActive()).toEqual(true);
    });

    it('offers a visibility toggle on the password field', async () => {
        const component = await renderLoginForm({ prefillIdentifier: 'jane@example.com' });

        expect(component.root.findAllByProps({ testID: 'login-password-visibility-toggle' }).length)
            .toBeGreaterThan(0);
    });

    describe('failed sign-in', () => {
        // The reported bug: a wrong password cleared the spinner and showed nothing. Assert on
        // the inline error rather than the toast, since the alert is the part that stays put.
        const submitAndFail = async (rejection: any) => {
            const login = jest.fn(() => Promise.reject(rejection));
            const component = await renderLoginForm({ login });
            const instance: any = component.getInstance();

            await act(async () => {
                instance.onInputChange('userName', 'jane@example.com');
                instance.onInputChange('password', 'wrong-password');
            });
            await act(async () => {
                instance.onSubmit();
            });

            return { component, instance, login };
        };

        it('tells the user their credentials were rejected', async () => {
            const { instance } = await submitAndFail({ statusCode: 401, message: 'Incorrect user/password combination' });

            expect(instance.state.prevLoginError).toEqual('Invalid username/password combination.');
            expect(instance.state.isSubmitting).toEqual(false);
        });

        it('names an unverified account instead of blaming the password', async () => {
            const { instance } = await submitAndFail({ statusCode: 401, errorCode: ErrorCodes.NOT_VERIFIED });

            expect(instance.state.prevLoginError).toContain('not verified');
        });

        it('still says something when the rejection carries no statusCode', async () => {
            // What a hijacked 401 used to look like by the time it reached the form: the
            // interceptor's refresh-and-retry rejected it with a bare Error instead.
            const { instance } = await submitAndFail(new Error('No refresh token available'));

            expect(instance.state.prevLoginError).toEqual('Connection error. Please try again later.');
            expect(instance.state.isSubmitting).toEqual(false);
        });

        it('clears the previous error when the next attempt starts', async () => {
            const { instance } = await submitAndFail({ statusCode: 401 });

            expect(instance.state.prevLoginError).not.toEqual('');

            act(() => {
                instance.onInputChange('password', 'another-try');
            });

            expect(instance.state.prevLoginError).toEqual('');
        });
    });

    it('drops back to the password step when the identifier stops looking like a phone number', async () => {
        const component = await renderLoginForm({ prefillIdentifier: '+13175551234' });
        const instance: any = component.getInstance();

        act(() => {
            instance.onInputChange('userName', 'jane@example.com');
        });

        expect(instance.isPhoneModeActive()).toEqual(false);
        expect(component.root.findAllByProps({ testID: 'login-password' }).length).toBeGreaterThan(0);
    });
});
