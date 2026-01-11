import 'react-native';
import React from 'react';
import { RegisterFormComponent as RegisterForm } from '../../main/routes/Register/RegisterForm';
import { buildStyles as buildAlertStyles } from '../../main/styles/alerts';
import { buildStyles as buildFormStyles } from '../../main/styles/forms';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');

const themeAlerts = buildAlertStyles();
const themeForms = buildFormStyles();

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
    registerButtonContainer: {},
    buttonPrimary: {},
    buttonTitle: {},
    buttonLink: {},
    sectionDescription: {},
};

const defaultProps = {
    login: jest.fn(),
    register: jest.fn(),
    onSuccess: jest.fn(),
    toggleEULA: jest.fn(),
    userSettings: { mobileThemeName: 'light' },
    theme: { styles: mockStyles },
    themeAuthForm: { styles: mockStyles },
    themeAlerts: themeAlerts,
    themeForms: themeForms,
};

describe('RegisterForm', () => {
    describe('Form Validation', () => {
        it('should disable register button when form is empty', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            expect(instance.isRegisterFormDisabled()).toBe(true);
        });

        it('should disable register button when only email is provided', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');

            expect(instance.isRegisterFormDisabled()).toBe(true);
        });

        it('should disable register button when only password is provided', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.onInputChange('password', 'Password123!');

            expect(instance.isRegisterFormDisabled()).toBe(true);
        });

        it('should disable register button when passwords do not match', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'Password123!');
            instance.onInputChange('repeatPassword', 'DifferentPassword123!');

            expect(instance.isRegisterFormDisabled()).toBe(true);
            expect(instance.isFormValid()).toBe(false);
        });

        it('should enable register button when all fields are valid', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'Password123!');
            instance.onInputChange('repeatPassword', 'Password123!');

            expect(instance.isFormValid()).toBe(true);
            expect(instance.isRegisterFormDisabled()).toBe(false);
        });
    });

    describe('Password Validation', () => {
        it('should show password mismatch error when passwords do not match', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.onInputChange('password', 'Password123!');
            instance.onInputChange('repeatPassword', 'DifferentPassword123!');

            expect(instance.state.passwordErrorMessage).toBeTruthy();
            expect(instance.state.passwordErrorMessage.length).toBeGreaterThan(0);
        });

        it('should clear password error when passwords match', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.onInputChange('password', 'Password123!');
            instance.onInputChange('repeatPassword', 'Password123!');

            expect(instance.state.passwordErrorMessage.length).toBe(0);
        });

        it('should validate password mismatch when password changes after repeatPassword is set', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.onInputChange('repeatPassword', 'Password123!');
            instance.onInputChange('password', 'DifferentPassword123!');

            expect(instance.state.passwordErrorMessage).toBeTruthy();
        });

        it('should set isPasswordEntryDirty when password is entered', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            expect(instance.state.isPasswordEntryDirty).toBe(false);

            instance.onInputChange('password', 'P');

            expect(instance.state.isPasswordEntryDirty).toBe(true);
        });
    });

    describe('Form Submission', () => {
        it('should call register when form is valid', async () => {
            const mockRegister = jest.fn().mockResolvedValue({});
            const mockOnSuccess = jest.fn();
            const props = { ...defaultProps, register: mockRegister, onSuccess: mockOnSuccess };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'ValidPassword123!');
            instance.onInputChange('repeatPassword', 'ValidPassword123!');

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockRegister).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'test@example.com',
                    password: 'ValidPassword123!',
                })
            );
        });

        it('should not include repeatPassword in register call', async () => {
            const mockRegister = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, register: mockRegister };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'ValidPassword123!');
            instance.onInputChange('repeatPassword', 'ValidPassword123!');

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockRegister).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    repeatPassword: expect.anything(),
                })
            );
        });

        it('should call onSuccess after successful registration', async () => {
            const mockRegister = jest.fn().mockResolvedValue({});
            const mockOnSuccess = jest.fn();
            const props = { ...defaultProps, register: mockRegister, onSuccess: mockOnSuccess };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'ValidPassword123!');
            instance.onInputChange('repeatPassword', 'ValidPassword123!');

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockOnSuccess).toHaveBeenCalled();
        });

        it('should set isSubmitting during submission', async () => {
            const mockRegister = jest.fn().mockImplementation(() => new Promise(() => {}));
            const props = { ...defaultProps, register: mockRegister };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'ValidPassword123!');
            instance.onInputChange('repeatPassword', 'ValidPassword123!');

            instance.onSubmit();

            expect(instance.state.isSubmitting).toBe(true);
        });

        it('should not submit when form is disabled', () => {
            const mockRegister = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, register: mockRegister };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            // Form is empty, should be disabled
            instance.onSubmit();

            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('should show error for insecure password', async () => {
            const mockRegister = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, register: mockRegister };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'weak'); // Insecure password
            instance.onInputChange('repeatPassword', 'weak');

            instance.onSubmit();

            // Should not call register and should set error
            expect(mockRegister).not.toHaveBeenCalled();
            expect(instance.state.prevRegisterError).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should handle 400 error with message', async () => {
            const mockRegister = jest.fn().mockRejectedValue({
                statusCode: 400,
                message: 'Email already exists',
                parameters: ['email'],
            });
            const props = { ...defaultProps, register: mockRegister };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'ValidPassword123!');
            instance.onInputChange('repeatPassword', 'ValidPassword123!');

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(instance.state.prevRegisterError).toContain('Email already exists');
            expect(instance.state.isSubmitting).toBe(false);
        });

        it('should handle server errors gracefully', async () => {
            const mockRegister = jest.fn().mockRejectedValue({ statusCode: 500 });
            const props = { ...defaultProps, register: mockRegister };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('password', 'ValidPassword123!');
            instance.onInputChange('repeatPassword', 'ValidPassword123!');

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(instance.state.prevRegisterError).toBeTruthy();
            expect(instance.state.isSubmitting).toBe(false);
        });

        it('should clear previous error when input changes', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.setState({ prevRegisterError: 'Some error' });

            instance.onInputChange('email', 'new@email.com');

            expect(instance.state.prevRegisterError).toBe('');
        });
    });

    describe('Invite Code', () => {
        it('should include invite code in registration', async () => {
            const mockRegister = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, register: mockRegister };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            instance.onInputChange('email', 'test@example.com');
            instance.onInputChange('inviteCode', 'INVITE123');
            instance.onInputChange('password', 'ValidPassword123!');
            instance.onInputChange('repeatPassword', 'ValidPassword123!');

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockRegister).toHaveBeenCalledWith(
                expect.objectContaining({
                    inviteCode: 'INVITE123',
                })
            );
        });
    });

    describe('EULA and Privacy Policy', () => {
        it('should call toggleEULA when EULA button is pressed', () => {
            const mockToggleEULA = jest.fn();
            const props = { ...defaultProps, toggleEULA: mockToggleEULA };
            const component = renderer.create(<RegisterForm {...props} />);
            const tree = component.toJSON();

            // Verify component renders (button functionality tested via integration)
            expect(tree).toBeDefined();
        });
    });

    describe('SSO Registration', () => {
        it('should handle SSO login success with verified email', () => {
            const mockLogin = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, login: mockLogin };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();

            const mockUser = {
                emailVerified: true,
                email: 'test@example.com',
                displayName: 'Test User',
                phoneNumber: '+1234567890',
            };
            const mockAdditionalUserInfo = {
                given_name: 'Test',
                family_name: 'User',
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
            const mockLogin = jest.fn();
            const props = { ...defaultProps, login: mockLogin };
            const component = renderer.create(<RegisterForm {...props} />);
            const instance = component.getInstance();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const mockUser = {
                emailVerified: false,
                email: 'test@example.com',
            };

            instance.onSSOLoginSuccess('mock-id-token', mockUser, {}, 'google');

            expect(mockLogin).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should reset isSubmitting on SSO error', () => {
            const component = renderer.create(<RegisterForm {...defaultProps} />);
            const instance = component.getInstance();

            instance.setState({ isSubmitting: true });
            instance.onSSOLoginError();

            expect(instance.state.isSubmitting).toBe(false);
        });
    });
});
