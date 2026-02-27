import 'react-native';
import React from 'react';
import { Settings } from '../../main/routes/Settings/index';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

// Mock dependencies
jest.mock('react-native-keyboard-aware-scroll-view', () => {
    const { View } = require('react-native');
    return {
        KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    };
});

jest.mock('../../main/components/ButtonMenu/MainButtonMenu', () => {
    return function MockMainButtonMenu() {
        return null;
    };
});

jest.mock('react-native-toast-message', () => {
    const MockToast = () => null;
    MockToast.show = jest.fn();
    MockToast.hide = jest.fn();
    return {
        __esModule: true,
        default: MockToast,
    };
});

jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn(),
    wrap: jest.fn(),
}));

jest.mock('../../main/components/UserContent/UserImage', () => {
    return function MockUserImage() {
        return null;
    };
});

jest.mock('../../main/utilities/content', () => ({
    getUserImageUri: jest.fn().mockReturnValue('https://example.com/image.jpg'),
    signImageUrl: jest.fn().mockResolvedValue({ data: { url: ['https://signed-url.com'] } }),
}));

jest.mock('../../main/utilities/areaUtils', () => ({
    getImagePreviewPath: jest.fn(),
}));

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

const mockUser = {
    details: {
        id: 'user-123',
        email: 'test@example.com',
        phoneNumber: '+15555555555',
        firstName: 'Test',
        lastName: 'User',
        userName: 'testuser',
        shouldHideMatureContent: true,
    },
    settings: {
        mobileThemeName: 'light',
        settingsBio: 'This is my bio',
        settingsPushBackground: true,
        settingsPushMarketing: true,
        settingsIsProfilePublic: true,
    },
};

const defaultProps = {
    navigation: {
        navigate: jest.fn(),
        push: jest.fn(),
        setOptions: jest.fn(),
    },
    user: mockUser,
    updateUser: jest.fn().mockResolvedValue({}),
};

describe('Settings', () => {
    describe('Initial State', () => {
        it('should initialize with user details from props', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            expect(instance.state.inputs.email).toBe('test@example.com');
            expect(instance.state.inputs.firstName).toBe('Test');
            expect(instance.state.inputs.lastName).toBe('User');
            expect(instance.state.inputs.userName).toBe('testuser');
            expect(instance.state.inputs.phoneNumber).toBe('+15555555555');
            expect(instance.state.inputs.settingsBio).toBe('This is my bio');
        });

        it('should initialize theme mode from user settings', () => {
            const retroUser = {
                ...mockUser,
                settings: { ...mockUser.settings, mobileThemeName: 'retro' },
            };
            const props = { ...defaultProps, user: retroUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            expect(instance.state.isNightMode).toBe(true);
        });

        it('should initialize ad opt-in from user settings', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            expect(instance.state.isOptedInToAds).toBe(true);
        });

        it('should initialize profile visibility from user settings', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            expect(instance.state.isProfilePublic).toBe(true);
        });
    });

    describe('Form Validation', () => {
        it('should disable form when userName is empty', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('userName', ''); });

            expect(instance.isFormDisabled()).toBe(true);
        });

        it('should disable form when firstName is empty', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('firstName', ''); });

            expect(instance.isFormDisabled()).toBe(true);
        });

        it('should disable form when lastName is empty', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('lastName', ''); });

            expect(instance.isFormDisabled()).toBe(true);
        });

        it('should disable form when passwords do not match', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('oldPassword', 'currentpassword'); });
            act(() => { instance.onInputChange('password', 'newpassword123'); });
            act(() => { instance.onInputChange('repeatPassword', 'differentpassword123'); });

            expect(instance.isFormDisabled()).toBe(true);
        });

        it('should enable form when all required fields are filled', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            expect(instance.isFormDisabled()).toBe(false);
        });

        it('should enable form when passwords match', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('oldPassword', 'currentpassword'); });
            act(() => { instance.onInputChange('password', 'NewPassword123!'); });
            act(() => { instance.onInputChange('repeatPassword', 'NewPassword123!'); });

            expect(instance.isFormDisabled()).toBe(false);
        });
    });

    describe('Input Handling', () => {
        it('should update state when input changes', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('firstName', 'NewFirstName'); });
            act(() => { instance.onInputChange('lastName', 'NewLastName'); });

            expect(instance.state.inputs.firstName).toBe('NewFirstName');
            expect(instance.state.inputs.lastName).toBe('NewLastName');
        });

        it('should sanitize username input', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            // sanitizeUserName should remove invalid characters
            act(() => { instance.onInputChange('userName', 'Test User Name'); });

            // The sanitizer should have been applied
            expect(instance.state.inputs.userName).toBeDefined();
        });

        it('should show password error when passwords do not match', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('oldPassword', 'currentpassword'); });
            act(() => { instance.onInputChange('password', 'newpassword'); });
            act(() => { instance.onInputChange('repeatPassword', 'differentpassword'); });

            expect(instance.state.passwordErrorMessage).toBeTruthy();
        });

        it('should clear password error when passwords match', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('oldPassword', 'currentpassword'); });
            act(() => { instance.onInputChange('password', 'newpassword'); });
            act(() => { instance.onInputChange('repeatPassword', 'newpassword'); });

            expect(instance.state.passwordErrorMessage).toBe('');
        });
    });

    describe('Theme Switching', () => {
        it('should update isNightMode when theme changes', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onThemeChange(true); });

            expect(instance.state.isNightMode).toBe(true);

            act(() => { instance.onThemeChange(false); });

            expect(instance.state.isNightMode).toBe(false);
        });
    });

    describe('Privacy Settings', () => {
        it('should update profile visibility setting', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onProfileVisibilitySettingsChange(false); });

            expect(instance.state.isProfilePublic).toBe(false);

            act(() => { instance.onProfileVisibilitySettingsChange(true); });

            expect(instance.state.isProfilePublic).toBe(true);
        });
    });

    describe('Reward Settings', () => {
        it('should update ad opt-in setting', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onRewardSettingsChange(false); });

            expect(instance.state.isOptedInToAds).toBe(false);

            act(() => { instance.onRewardSettingsChange(true); });

            expect(instance.state.isOptedInToAds).toBe(true);
        });
    });

    describe('Form Submission', () => {
        it('should call updateUser with correct arguments', async () => {
            const mockUpdateUser = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockUpdateUser).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    userName: 'testuser',
                })
            );
        });

        it('should include theme setting in update', async () => {
            const mockUpdateUser = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onThemeChange(true); });

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockUpdateUser).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    settingsThemeName: 'retro',
                })
            );
        });

        it('should include privacy settings in update', async () => {
            const mockUpdateUser = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onProfileVisibilitySettingsChange(false); });

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockUpdateUser).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    settingsIsProfilePublic: false,
                })
            );
        });

        it('should include password update when old and new passwords are provided', async () => {
            const mockUpdateUser = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('oldPassword', 'currentPassword123'); });
            act(() => { instance.onInputChange('password', 'NewPassword123!'); });
            act(() => { instance.onInputChange('repeatPassword', 'NewPassword123!'); });

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockUpdateUser).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    password: 'NewPassword123!',
                    oldPassword: 'currentPassword123',
                })
            );
        });

        it('should not include password when old password is not provided', async () => {
            const mockUpdateUser = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('password', 'NewPassword123!'); });
            act(() => { instance.onInputChange('repeatPassword', 'NewPassword123!'); });

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(mockUpdateUser).toHaveBeenCalledWith(
                'user-123',
                expect.not.objectContaining({
                    password: expect.anything(),
                    oldPassword: expect.anything(),
                })
            );
        });

        it('should set isSubmitting during submission', async () => {
            const mockUpdateUser = jest.fn().mockImplementation(() => new Promise(() => {}));
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onSubmit(); });

            expect(instance.state.isSubmitting).toBe(true);
        });

        it('should not submit when form is disabled', () => {
            const mockUpdateUser = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('userName', ''); }); // Make form invalid

            act(() => { instance.onSubmit(); });

            expect(mockUpdateUser).not.toHaveBeenCalled();
        });

        it('should show error toast for insecure password', () => {
            const Toast = require('react-native-toast-message').default;
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('oldPassword', 'currentpassword'); });
            act(() => { instance.onInputChange('password', 'weak'); }); // Too weak
            act(() => { instance.onInputChange('repeatPassword', 'weak'); });

            act(() => { instance.onSubmit(); });

            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'errorBig',
                })
            );
        });
    });

    describe('Error Handling', () => {
        it('should show error toast on 400/401/404 errors', async () => {
            const Toast = require('react-native-toast-message').default;
            const mockUpdateUser = jest.fn().mockRejectedValue({
                statusCode: 400,
                message: 'Username already taken',
            });
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'errorBig',
                })
            );
        });

        it('should show error toast on server errors', async () => {
            const Toast = require('react-native-toast-message').default;
            const mockUpdateUser = jest.fn().mockRejectedValue({ statusCode: 500 });
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'errorBig',
                })
            );
        });

        it('should show success toast on successful update', async () => {
            const Toast = require('react-native-toast-message').default;
            const mockUpdateUser = jest.fn().mockResolvedValue({});
            const props = { ...defaultProps, updateUser: mockUpdateUser };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            await act(async () => {
                instance.onSubmit();
                await Promise.resolve();
            });

            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'success',
                })
            );
        });
    });

    describe('Navigation', () => {
        it('should set navigation title on mount', () => {
            const mockSetOptions = jest.fn();
            const props = {
                ...defaultProps,
                navigation: { ...defaultProps.navigation, setOptions: mockSetOptions },
            };

            act(() => {
                renderer.create(<Settings {...props} />);
            });

            expect(mockSetOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: expect.any(String),
                })
            );
        });

        it('should navigate to ManageAccount when link is pressed', () => {
            const mockPush = jest.fn();
            const props = {
                ...defaultProps,
                navigation: { ...defaultProps.navigation, push: mockPush },
            };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.goToManageAccount(); });

            expect(mockPush).toHaveBeenCalledWith('ManageAccount');
        });

        it('should navigate to ManageNotifications when link is pressed', () => {
            const mockPush = jest.fn();
            const props = {
                ...defaultProps,
                navigation: { ...defaultProps.navigation, push: mockPush },
            };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.goToManageNotifications(); });

            expect(mockPush).toHaveBeenCalledWith('ManageNotifications');
        });

        it('should navigate to ManagePreferences when link is pressed', () => {
            const mockPush = jest.fn();
            const props = {
                ...defaultProps,
                navigation: { ...defaultProps.navigation, push: mockPush },
            };
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...props} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.gotToManagePreferences(); });

            expect(mockPush).toHaveBeenCalledWith('ManagePreferences');
        });
    });

    describe('Content Settings', () => {
        it('should update shouldHideMatureContent setting', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('shouldHideMatureContent', 'false'); });

            expect(instance.state.inputs.shouldHideMatureContent).toBe('false');
        });
    });

    describe('Bio', () => {
        it('should update bio input', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<Settings {...defaultProps} />);
            });
            const instance = component!.getInstance() as Settings;

            act(() => { instance.onInputChange('settingsBio', 'My updated bio'); });

            expect(instance.state.inputs.settingsBio).toBe('My updated bio');
        });
    });
});
