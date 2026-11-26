import 'react-native';
import React from 'react';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

/**
 * "Continue with Google" placement on the auth screens
 *
 * A new user's feedback was that sign-in felt complicated and asked for Google sign-in — which
 * already existed, but only under the manual form on Login and only on the *email* sign-up
 * path, never on the phone-first one that Register opens on. These tests pin the fix: SSO
 * leads both screens, except for invite links, whose e-mail form must stay first because SSO
 * sign-up does not yet carry the invite token.
 */

jest.mock('therr-react/services', () => ({
    ApiService: {
        startPhoneLogin: jest.fn().mockResolvedValue({}),
        startPhoneRegistration: jest.fn().mockResolvedValue({}),
        verifyPhoneRegistration: jest.fn().mockResolvedValue({}),
    },
    UsersService: {
        getInviteByToken: jest.fn(() => Promise.resolve({ data: {} })),
    },
}));

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
    AppleButton: { Type: { SIGN_IN: 'SIGN_IN', CONTINUE: 'CONTINUE' } },
}));

jest.mock('../../main/components/LoginButtons/GoogleSignInButton', () => function MockGoogleSignInButton() {
    return null;
});

jest.mock('../../main/components/LoginButtons/AppleSignInButton', () => function MockAppleSignInButton() {
    return null;
});

jest.mock('../../main/components/Modals/AccountPickerModal', () => function MockAccountPickerModal() {
    return null;
});

jest.mock('../../main/components/Modals/ConfirmModal', () => function MockConfirmModal() {
    return null;
});

jest.mock('../../main/components/LanguageSelector', () => function MockLanguageSelector() {
    return null;
});

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');
jest.mock('react-native-date-picker', () => 'DatePicker');

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';
import { LoginFormComponent as LoginForm } from '../../main/routes/Login/LoginForm';
import { RegisterComponent as Register } from '../../main/routes/Register';
import { RegisterFormComponent as RegisterForm } from '../../main/routes/Register/RegisterForm';
import SSOButtons from '../../main/components/LoginButtons/SSOButtons';
import { buildSSOUserDetails, getSSOErrorCopy } from '../../main/utilities/ssoLogin';
import { buildStyles as buildAlertStyles } from '../../main/styles/alerts';
import { buildStyles as buildFormStyles } from '../../main/styles/forms';
import { buildStyles as buildAuthFormStyles } from '../../main/styles/forms/authenticationForms';

const themeAlerts = buildAlertStyles();
const themeForms = buildFormStyles();
const themeAuthForm = buildAuthFormStyles();

const mounted: renderer.ReactTestRenderer[] = [];

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    // Unmount before the environment tears down: Paper's TextInput and the phone input
    // schedule timers that otherwise fire into a dead renderer.
    act(() => {
        mounted.splice(0).forEach((tree) => tree.unmount());
    });
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
});

const translate = (key: string) => key;

const render = (element: React.ReactElement) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(element);
    });
    mounted.push(tree!);
    return tree!;
};

describe('buildSSOUserDetails', () => {
    it('builds the login payload for a verified account', () => {
        const details = buildSSOUserDetails(
            'id-token',
            { emailVerified: true, email: 'a@b.co', phoneNumber: '+15555550100' },
            { given_name: 'Ada', family_name: 'Lovelace', profile: { nonce: 'n' } },
            'google',
            'android',
        );

        expect(details).toEqual({
            isSSO: true,
            idToken: 'id-token',
            nonce: 'n',
            ssoProvider: 'google',
            ssoPlatform: 'android',
            userPhoneNumber: '+15555550100',
            userFirstName: 'Ada',
            userLastName: 'Lovelace',
            userEmail: 'a@b.co',
        });
    });

    it('falls back to the display name when the provider sends no given/family name', () => {
        // Regression: this read `displayName.split[0]`, which is always undefined.
        const details = buildSSOUserDetails(
            'id-token',
            { emailVerified: true, email: 'a@b.co', displayName: 'Ada King Lovelace' },
            {},
            'apple',
            'ios',
        );

        expect(details?.userFirstName).toBe('Ada');
        expect(details?.userLastName).toBe('King Lovelace');
    });

    it('returns null when the provider has not verified the e-mail', () => {
        expect(buildSSOUserDetails('id-token', { emailVerified: false, email: 'a@b.co' }, {}, 'google', 'ios')).toBeNull();
    });
});

describe('getSSOErrorCopy', () => {
    it('stays quiet when the user cancels', () => {
        expect(getSSOErrorCopy({ message: 'The user canceled the sign in request' }, translate)).toBeNull();
    });

    it('maps provider-specific failures', () => {
        expect(getSSOErrorCopy({ message: 'RNGoogleSignInError: x' }, translate)?.title).toBe('alertTitles.errorWithGoogleSSO');
        expect(getSSOErrorCopy({ message: 'com.apple.AuthenticationServices.AuthorizationError 1000' }, translate)?.title)
            .toBe('alertTitles.errorWithAppleSSO');
        expect(getSSOErrorCopy(undefined, translate)?.title).toBe('alertTitles.backendErrorMessage');
    });
});

describe('Login screen', () => {
    const props = {
        login: jest.fn(),
        loginWithPhone: jest.fn(),
        selectPhoneLoginAccount: jest.fn(),
        navigation: { navigate: jest.fn() },
        userSettings: {},
        themeAlerts,
        themeAuthForm,
        themeForms,
    };

    it('offers SSO above the identifier field', () => {
        const tree = render(<LoginForm {...props} />);
        const ordered = tree.root.findAll((node) => node.type === SSOButtons || node.props.testID === 'login-username', { deep: true });

        expect(ordered[0].type).toBe(SSOButtons);
        expect(ordered[0].props.intent).toBe('signIn');
        expect(ordered.some((node) => node.props.testID === 'login-username')).toBe(true);
    });
});

describe('Register screen', () => {
    const baseProps = {
        login: jest.fn(),
        register: jest.fn(),
        setPreLoginLocale: jest.fn(),
        navigation: { navigate: jest.fn(), setOptions: jest.fn() },
        user: { settings: {} } as any,
    };

    it('leads with SSO on the default (phone-first) sign-up', () => {
        const tree = render(<Register {...baseProps} route={{ params: {} }} />);
        const ssoBlocks = tree.root.findAllByType(SSOButtons);

        expect(ssoBlocks).toHaveLength(1);
        expect(ssoBlocks[0].props.intent).toBe('continue');
    });

    it('keeps SSO below the e-mail form for invite links', async () => {
        const tree = render(<Register {...baseProps} route={{ params: { inviteToken: 'tok' } }} />);
        // Let the invite-token lookup started on mount settle inside act.
        await act(async () => {});
        const form = tree.root.findByType(RegisterForm);

        expect(form.props.showSSOButtons).toBe(true);
        // Exactly one SSO block on screen, and it is the form's own — not one above it.
        const ssoBlocks = tree.root.findAllByType(SSOButtons);
        expect(ssoBlocks).toHaveLength(1);
        expect(form.findAllByType(SSOButtons)).toHaveLength(1);
    });

    it('signs in with the SSO payload from the top buttons', async () => {
        const login = jest.fn(() => Promise.resolve());
        const tree = render(<Register {...baseProps} login={login} route={{ params: {} }} />);
        const sso = tree.root.findByType(SSOButtons);

        await act(async () => {
            sso.props.onLoginSuccess('id-token', { emailVerified: true, email: 'a@b.co' }, { given_name: 'Ada' }, 'google');
        });

        expect(login).toHaveBeenCalledWith(
            expect.objectContaining({ isSSO: true, idToken: 'id-token', ssoProvider: 'google', userEmail: 'a@b.co' }),
            { googleSSOIdToken: 'id-token' },
        );
    });
});
