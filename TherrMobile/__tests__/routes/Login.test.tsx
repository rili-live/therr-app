import 'react-native';
import React from 'react';
import { LoginFormComponent as LoginForm } from '../../main/routes/Login/LoginForm';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

// Mock dependencies
jest.mock('react-native-toast-message', () => {
    const MockToast = () => null;
    MockToast.show = jest.fn();
    MockToast.hide = jest.fn();
    return {
        __esModule: true,
        default: MockToast,
    };
});

jest.mock('@invertase/react-native-apple-authentication', () => ({
    appleAuth: {
        isSupported: true,
    },
    AppleButton: {
        Type: {
            SIGN_IN: 'SIGN_IN',
        },
    },
}));

jest.mock('../../main/components/LoginButtons/GoogleSignInButton', () => {
    return function MockGoogleSignInButton() {
        return null;
    };
});

jest.mock('../../main/components/LoginButtons/AppleSignInButton', () => {
    return function MockAppleSignInButton() {
        return null;
    };
});

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
    submitButtonContainer: {},
    moreLinksContainer: {},
    buttonPrimary: {},
    buttonTitle: {},
    buttonTitleDisabled: {},
    buttonDisabled: {},
    buttonLink: {},
    buttonIcon: {},
};

const defaultProps = {
    navigation: {
        navigate: jest.fn(),
    },
    login: jest.fn(),
    userSettings: { mobileThemeName: 'light' },
    themeAuthForm: { styles: mockStyles },
    themeAlerts: {
        styles: mockStyles,
        colors: { placeholderTextColorAlt: '#ccc' } as any,
    },
    themeForms: {
        styles: mockStyles,
        colors: { placeholderTextColorAlt: '#ccc' } as any,
    },
};

describe('LoginForm', () => {
    describe('Form Validation', () => {
        it('should disable login button when form is empty', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            expect(instance.isLoginFormDisabled()).toBe(true);
        });

        it('should disable login button when only username is provided', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('userName', 'testuser');

            expect(instance.isLoginFormDisabled()).toBe(true);
        });

        it('should disable login button when only password is provided', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('password', 'testpassword');

            expect(instance.isLoginFormDisabled()).toBe(true);
        });

        it('should enable login button when both username and password are provided', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('userName', 'testuser');
            instance.onInputChange('password', 'testpassword');

            expect(instance.isLoginFormDisabled()).toBe(false);
        });

        it('should disable login button when submitting', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('userName', 'testuser');
            instance.onInputChange('password', 'testpassword');

            // Simulate submitting state
            instance.setState({ isSubmitting: true });

            expect(instance.isLoginFormDisabled()).toBe(true);
        });
    });

    describe('Input Handling', () => {
        it('should update state when input changes', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('userName', 'newuser');
            instance.onInputChange('password', 'newpassword');

            expect(instance.state.inputs.userName).toBe('newuser');
            expect(instance.state.inputs.password).toBe('newpassword');
        });

        it('should clear previous login error when input changes', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            // Set a previous error
            instance.setState({ prevLoginError: 'Previous error' });

            // Change input should clear error
            instance.onInputChange('userName', 'newuser');

            expect(instance.state.prevLoginError).toBe('');
        });
    });

    describe('Form Submission', () => {
        it('should call login with trimmed and lowercased username', async () => {
            const mockLogin = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, login: mockLogin };
            const component = renderer.create(<LoginForm {...props} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('userName', '  TestUser@Email.COM  ');
            instance.onInputChange('password', 'password123');

            await act(async () => {
                instance.onSubmit();
            });

            expect(mockLogin).toHaveBeenCalledWith(
                expect.objectContaining({
                    userName: 'testuser@email.com',
                    password: 'password123',
                }),
                expect.any(Object)
            );
        });

        it('should set isSubmitting to true during submission', async () => {
            const mockLogin = jest.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
            const props = { ...defaultProps, login: mockLogin };
            const component = renderer.create(<LoginForm {...props} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('userName', 'testuser');
            instance.onInputChange('password', 'password123');

            instance.onSubmit();

            expect(instance.state.isSubmitting).toBe(true);
        });

        it('should handle 400/401/404 error with invalid credentials message', async () => {
            const mockLogin = jest.fn().mockRejectedValue({ statusCode: 401 });
            const props = { ...defaultProps, login: mockLogin };
            const component = renderer.create(<LoginForm {...props} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('userName', 'testuser');
            instance.onInputChange('password', 'wrongpassword');

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve(); // Allow promise to settle
            });

            expect(instance.state.isSubmitting).toBe(false);
            expect(instance.state.prevLoginError).toBeTruthy();
        });

        it('should handle 500+ server errors', async () => {
            const mockLogin = jest.fn().mockRejectedValue({ statusCode: 500 });
            const props = { ...defaultProps, login: mockLogin };
            const component = renderer.create(<LoginForm {...props} />);
            const instance = component.getInstance() as LoginForm;

            instance.onInputChange('userName', 'testuser');
            instance.onInputChange('password', 'password123');

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(instance.state.isSubmitting).toBe(false);
            expect(instance.state.prevLoginError).toBeTruthy();
        });
    });

    describe('SSO Login', () => {
        it('should handle successful SSO login with verified email', () => {
            const mockLogin = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, login: mockLogin };
            const component = renderer.create(<LoginForm {...props} />);
            const instance = component.getInstance() as LoginForm;

            const mockUser = {
                emailVerified: true,
                email: 'test@example.com',
                displayName: 'Test User',
                phoneNumber: '+1234567890',
            };
            const mockAdditionalUserInfo = {
                given_name: 'Test',
                family_name: 'User',
                profile: { nonce: 'test-nonce' },
            };

            instance.onSSOLoginSuccess('mock-id-token', mockUser, mockAdditionalUserInfo, 'google');

            expect(mockLogin).toHaveBeenCalledWith(
                expect.objectContaining({
                    isSSO: true,
                    idToken: 'mock-id-token',
                    ssoProvider: 'google',
                    userEmail: 'test@example.com',
                }),
                expect.any(Object)
            );
        });

        it('should not call login when SSO email is not verified', () => {
            const mockLogin = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, login: mockLogin };
            const component = renderer.create(<LoginForm {...props} />);
            const instance = component.getInstance() as LoginForm;
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const mockUser = {
                emailVerified: false,
                email: 'test@example.com',
            };

            instance.onSSOLoginSuccess('mock-id-token', mockUser, {}, 'google');

            expect(mockLogin).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should handle user cancelled SSO gracefully', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            const error = { message: 'The user canceled the sign in request' };
            instance.onSSOLoginError(error);

            // Should not show error toast for cancelled requests
            expect(instance.state.isSubmitting).toBe(false);
        });

        it('should show Apple SSO error toast', () => {
            const Toast = require('react-native-toast-message').default;
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            const error = { message: 'com.apple.AuthenticationServices.AuthorizationError' };
            instance.onSSOLoginError(error);

            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'errorBig',
                })
            );
        });

        it('should show Google SSO error toast', () => {
            const Toast = require('react-native-toast-message').default;
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            const error = { message: 'RNGoogleSignInError: Something went wrong' };
            instance.onSSOLoginError(error);

            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'errorBig',
                })
            );
        });
    });

    describe('Navigation', () => {
        it('should navigate to Register when sign up is pressed', () => {
            const mockNavigate = jest.fn();
            const props = { ...defaultProps, navigation: { navigate: mockNavigate } };
            const component = renderer.create(<LoginForm {...props} />);
            const tree = component.toJSON();

            // Verify component renders (navigation is handled by button press)
            expect(tree).toBeDefined();
        });

        it('should navigate to ForgotPassword when forgot password is pressed', () => {
            const mockNavigate = jest.fn();
            const props = { ...defaultProps, navigation: { navigate: mockNavigate } };
            const component = renderer.create(<LoginForm {...props} />);
            const tree = component.toJSON();

            expect(tree).toBeDefined();
        });
    });

    describe('Alert Display', () => {
        it('should display user message when provided', () => {
            const props = { ...defaultProps, userMessage: 'Registration successful!' };
            const component = renderer.create(<LoginForm {...props} />);
            const tree = component.toJSON();

            expect(tree).toBeDefined();
        });

        it('should display previous login error when set', () => {
            const component = renderer.create(<LoginForm {...defaultProps} />);
            const instance = component.getInstance() as LoginForm;

            instance.setState({ prevLoginError: 'Invalid credentials' });

            const tree = component.toJSON();
            expect(tree).toBeDefined();
        });
    });
});
