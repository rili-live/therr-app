import 'react-native';
import React from 'react';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

/**
 * Pre-login language selector vs. in-flight verification
 *
 * `Layout.tsx` keys its `NavigationContainer` on the active locale, so picking a language
 * remounts every route. Navigation *state* survives that (see LocaleRemountState.test.tsx),
 * but component state does not — a remount takes the sign-in form back to its first step,
 * discarding the texted code, the number it was sent to, and the phone verification token.
 * To the user that looks like being kicked back to the start of sign-in.
 *
 * Login and Register therefore only render the selector on the first step of each flow, and
 * they learn which step they are on from these callbacks. These tests pin that contract: the
 * forms must report every step transition, in both directions.
 */

const mockStartPhoneLogin = jest.fn().mockResolvedValue({});
const mockStartPhoneRegistration = jest.fn().mockResolvedValue({});
jest.mock('therr-react/services', () => ({
    ApiService: {
        startPhoneLogin: (...args: any[]) => mockStartPhoneLogin(...args),
        startPhoneRegistration: (...args: any[]) => mockStartPhoneRegistration(...args),
        verifyPhoneRegistration: jest.fn().mockResolvedValue({}),
    },
}));

// The shared Button reads the active theme via useSelector. These tests render the unconnected
// forms with explicit props (no <Provider>), so stub useSelector to resolve against a default
// state instead of requiring a store.
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: (selector: (state: any) => any) => selector({ user: { settings: {} } }),
}));

jest.mock('../../main/utilities/rememberedProfiles', () => ({
    getRememberedProfiles: jest.fn(() => Promise.resolve([])),
    rememberCurrentUser: jest.fn(() => Promise.resolve()),
    forgetProfile: jest.fn(() => Promise.resolve([])),
}));

jest.mock('react-native-toast-message', () => {
    const MockToast = () => null;
    MockToast.show = jest.fn();
    MockToast.hide = jest.fn();
    return { __esModule: true, default: MockToast };
});

jest.mock('@invertase/react-native-apple-authentication', () => ({
    appleAuth: { isSupported: false },
    AppleButton: { Type: { SIGN_IN: 'SIGN_IN' } },
}));

jest.mock('../../main/components/LoginButtons/GoogleSignInButton', () => function MockGoogleSignInButton() {
    return null;
});

jest.mock('../../main/components/LoginButtons/AppleSignInButton', () => function MockAppleSignInButton() {
    return null;
});

// Renders through a react-native-paper `Portal`, which needs a PaperProvider these tests
// deliberately do without — the behavior under test is the step callback, not the picker.
jest.mock('../../main/components/Modals/AccountPickerModal', () => function MockAccountPickerModal() {
    return null;
});

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');
jest.mock('react-native-date-picker', () => 'DatePicker');

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';
import { LoginFormComponent as LoginForm } from '../../main/routes/Login/LoginForm';
import { PhoneSignupFormComponent as PhoneSignupForm } from '../../main/routes/Register/PhoneSignupForm';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

const mockStyles = {
    placeholderText: { color: 'white' },
    submitButtonContainer: {},
    registerButtonContainer: {},
    moreLinksContainer: {},
    buttonPrimary: {},
    buttonTitle: {},
    buttonTitleDisabled: {},
    buttonDisabled: {},
    buttonLink: {},
    buttonIcon: {},
    sectionDescription: {},
};

const mockTheme = {
    styles: mockStyles,
    colors: { placeholderTextColorAlt: '#ccc' } as any,
    colorVariations: {} as any,
};

describe('pre-login language selector visibility', () => {
    describe('LoginForm', () => {
        const defaultProps = {
            navigation: { navigate: jest.fn() },
            login: jest.fn(),
            loginWithPhone: jest.fn(),
            selectPhoneLoginAccount: jest.fn(),
            userSettings: { mobileThemeName: 'light' },
            themeAuthForm: { styles: mockStyles },
            themeAlerts: mockTheme,
            themeForms: mockTheme,
        };

        const renderForm = (onModeChange: any) => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<LoginForm {...defaultProps} onModeChange={onModeChange} />);
            });

            return component!.getInstance() as LoginForm;
        };

        it('reports the code step so the screen can hide the selector', async () => {
            const onModeChange = jest.fn();
            const instance = renderForm(onModeChange);

            act(() => { instance.onInputChange('userName', '3175448348'); });

            await act(async () => {
                instance.onRequestVerificationCode();
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(instance.state.mode).toBe('awaitingCode');
            expect(onModeChange).toHaveBeenCalledWith('awaitingCode');
        });

        it('reports the account-picker step, which also holds a token a remount would drop', () => {
            const onModeChange = jest.fn();
            const instance = renderForm(onModeChange);

            act(() => { instance.setState({ mode: 'selectingAccount' }); });

            expect(onModeChange).toHaveBeenCalledWith('selectingAccount');
        });

        it('reports the return to the identifier step so the selector comes back', async () => {
            const onModeChange = jest.fn();
            const instance = renderForm(onModeChange);

            act(() => { instance.onInputChange('userName', '3175448348'); });
            await act(async () => {
                instance.onRequestVerificationCode();
                await Promise.resolve();
                await Promise.resolve();
            });
            act(() => { instance.onUsePasswordInstead(); });

            expect(instance.state.mode).toBe('password');
            expect(onModeChange).toHaveBeenLastCalledWith('password');
        });

        it('does not fire when nothing but the identifier changes', () => {
            const onModeChange = jest.fn();
            const instance = renderForm(onModeChange);

            act(() => { instance.onInputChange('userName', 'someone@example.com'); });

            expect(onModeChange).not.toHaveBeenCalled();
        });
    });

    describe('PhoneSignupForm', () => {
        const defaultProps = {
            register: jest.fn(),
            onSuccess: jest.fn(),
            onSwitchToEmailSignup: jest.fn(),
            onSwitchToSignIn: jest.fn(),
            toggleEULA: jest.fn(),
            userSettings: { mobileThemeName: 'light' },
            theme: mockTheme,
            themeAlerts: mockTheme,
            themeAuthForm: { styles: mockStyles },
            themeForms: mockTheme,
        };

        const renderForm = (onStepChange: any) => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<PhoneSignupForm {...defaultProps} onStepChange={onStepChange} />);
            });

            return component!.getInstance() as PhoneSignupForm;
        };

        it('reports the code step so the screen can hide the selector', async () => {
            const onStepChange = jest.fn();
            const instance = renderForm(onStepChange);

            act(() => { instance.onPhoneInputChange('+13175448348', true); });

            await act(async () => {
                instance.onRequestCode();
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(instance.state.step).toBe('code');
            expect(onStepChange).toHaveBeenCalledWith('code');
        });

        it('reports the details step, which sits behind a verification token', () => {
            const onStepChange = jest.fn();
            const instance = renderForm(onStepChange);

            act(() => { instance.setState({ step: 'details' }); });

            expect(onStepChange).toHaveBeenCalledWith('details');
        });

        it('reports the return to the phone step so the selector comes back', () => {
            const onStepChange = jest.fn();
            const instance = renderForm(onStepChange);

            act(() => { instance.setState({ step: 'code' }); });
            act(() => { instance.setState({ step: 'phone' }); });

            expect(onStepChange).toHaveBeenLastCalledWith('phone');
        });
    });
});
