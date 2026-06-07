import 'react-native';
import React from 'react';
import { Provider } from 'react-redux';
import { CreateProfile } from '../../main/routes/CreateProfile/index';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

// The onboarding flow advances by calling `scrollViewRef.scrollTo(...)` inside
// the `.finally()` of every submit. The ref is a `react-native-keyboard-controller`
// KeyboardAwareScrollView, whose imperative handle exposes `scrollTo` but NOT the
// legacy `scrollToPosition`. A previous bug called `scrollToPosition`, which threw
// inside `.finally()` and left `isSubmitting` permanently `true` — silently locking
// users out of the rest of onboarding. These mocks reproduce that real ref shape so
// a regression (calling a method the ref does not have) makes the tests fail.
const mockScrollTo = jest.fn();
jest.mock('react-native-keyboard-controller', () => {
    const ReactLib = require('react');
    const { View } = require('react-native');
    const KeyboardAwareScrollView = ReactLib.forwardRef((props: any, ref: any) => {
        ReactLib.useImperativeHandle(ref, () => ({
            // Intentionally only the methods the real ref provides. No scrollToPosition.
            scrollTo: mockScrollTo,
            assureFocusedInputVisible: jest.fn(),
        }), []);
        return <View>{props.children}</View>;
    });
    return { KeyboardAwareScrollView };
});

jest.mock('react-native-toast-message', () => {
    const MockToast = () => null;
    MockToast.show = jest.fn();
    MockToast.hide = jest.fn();
    return { __esModule: true, default: MockToast };
});

jest.mock('lottie-react-native', () => 'LottieView');

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: { createChannel: jest.fn() },
    AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
    AndroidVisibility: { PUBLIC: 1 },
}));

jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn(),
    wrap: jest.fn(),
}));

jest.mock('../../main/components/UserContent/UserImage', () => {
    return function MockUserImage() {
        return null;
    };
});

jest.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('therr-react/services', () => ({
    UsersService: {
        getInterests: jest.fn().mockResolvedValue({ data: {} }),
    },
    ApiService: {
        verifyPhone: jest.fn().mockResolvedValue({}),
        validateCode: jest.fn().mockResolvedValue({}),
    },
}));

jest.mock('../../main/utilities/content', () => ({
    getUserImageUri: jest.fn().mockReturnValue('https://example.com/image.jpg'),
    signImageUrl: jest.fn().mockResolvedValue({ data: { url: ['https://signed-url.com'] } }),
}));

jest.mock('../../main/utilities/areaUtils', () => ({
    getImagePreviewPath: jest.fn(),
}));

jest.mock('../../main/utilities/contacts', () => ({
    synceMobileContacts: jest.fn().mockResolvedValue({ contacts: [], matchedUsers: [] }),
}));

const mockStore = {
    getState: () => ({ user: { settings: { mobileThemeName: 'light' } } }),
    subscribe: () => () => {},
    dispatch: () => {},
};

beforeEach(() => {
    jest.useFakeTimers();
    mockScrollTo.mockClear();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

const mockUser = {
    details: {
        id: 'user-123',
        email: 'test@example.com',
        phoneNumber: '',
        firstName: 'Test',
        lastName: 'User',
        userName: 'testuser',
    },
    settings: {
        mobileThemeName: 'light',
        locale: 'en-us',
    },
};

const buildProps = (overrides: any = {}) => ({
    navigation: {
        navigate: jest.fn(),
        push: jest.fn(),
        setOptions: jest.fn(),
    },
    route: { params: {} },
    user: mockUser,
    updateUser: jest.fn().mockResolvedValue({}),
    updateUserInterests: jest.fn().mockResolvedValue({}),
    ...overrides,
});

const renderCreateProfile = (props: any) => {
    const ref = React.createRef<CreateProfile>();
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <Provider store={mockStore as any}>
                <CreateProfile ref={ref} {...props} />
            </Provider>
        );
    });
    return { ref, component: component! };
};

describe('CreateProfile (onboarding flow)', () => {
    describe('Form gating — users must be able to advance', () => {
        it('enables the details step when a valid username is present', () => {
            const { ref } = renderCreateProfile(buildProps());
            // username "testuser" (>= 3 chars), not submitting → not disabled.
            expect(ref.current!.isFormUserDetailsDisabled()).toBe(false);
        });

        it('disables the details step when the username is too short', () => {
            const { ref } = renderCreateProfile(buildProps());
            act(() => { ref.current!.onInputChange('userName', 'ab'); });
            expect(ref.current!.isFormUserDetailsDisabled()).toBe(true);
        });

        it('does NOT keep the interests step permanently disabled (selection is gated in the child)', () => {
            // The interests submit gate lives inside CreateProfileInterests; the parent
            // must only block while a submit is in flight, never indefinitely.
            const { ref } = renderCreateProfile(buildProps());
            expect(ref.current!.isFormInterestsDisabled()).toBe(false);
        });
    });

    describe('Stage advancement', () => {
        it('advances details → interests after a successful submit', async () => {
            const { ref } = renderCreateProfile(buildProps());
            await act(async () => {
                ref.current!.onSubmit('details');
                await Promise.resolve();
            });
            expect(ref.current!.state.stage).toBe('interests');
        });

        it('advances interests → picture after submitting interests', async () => {
            const { ref } = renderCreateProfile(buildProps());
            await act(async () => {
                ref.current!.onSubmitInterests('interests', []);
                await Promise.resolve();
            });
            expect(ref.current!.state.stage).toBe('picture');
        });

        it('advances picture → phone via onContinue', () => {
            const { ref } = renderCreateProfile(buildProps());
            act(() => { ref.current!.onContinue(); });
            expect(ref.current!.state.stage).toBe('phone');
        });
    });

    describe('Regression: submit must never leave isSubmitting stuck true', () => {
        // This is the bug that locked users out of onboarding. After any submit
        // resolves, the `.finally()` scrolls the view and clears `isSubmitting`.
        // If the scroll call uses a method the ref does not implement, it throws
        // before `isSubmitting` is reset, disabling the button forever.

        it('clears isSubmitting and uses scrollTo (not scrollToPosition) after a successful submit', async () => {
            const { ref } = renderCreateProfile(buildProps());
            await act(async () => {
                ref.current!.onSubmit('details');
                await Promise.resolve();
            });
            expect(ref.current!.state.isSubmitting).toBe(false);
            expect(mockScrollTo).toHaveBeenCalled();
        });

        it('clears isSubmitting even when the update request fails', async () => {
            const updateUser = jest.fn().mockRejectedValue({ statusCode: 500 });
            const { ref } = renderCreateProfile(buildProps({ updateUser }));
            await act(async () => {
                ref.current!.onSubmit('details');
                await Promise.resolve();
            });
            expect(ref.current!.state.isSubmitting).toBe(false);
        });

        it('clears isSubmitting after submitting interests', async () => {
            const { ref } = renderCreateProfile(buildProps());
            await act(async () => {
                ref.current!.onSubmitInterests('interests', []);
                await Promise.resolve();
            });
            expect(ref.current!.state.isSubmitting).toBe(false);
        });
    });
});
