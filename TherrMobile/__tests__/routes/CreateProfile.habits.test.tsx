import 'react-native';
import React from 'react';
import { Provider } from 'react-redux';
import { CreateProfile, getStageOrder } from '../../main/routes/CreateProfile/index';

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

// The HABITS stage order and exit. The full Therr order is in CreateProfile.test.tsx.
jest.mock('../../main/config/brandConfig', () => ({
    ...jest.requireActual('../../main/config/brandConfig'),
    CURRENT_BRAND_VARIATION: 'habits',
}));

const mockGetHabitsLandingRouteName = jest.fn().mockResolvedValue('HabitsDashboard');
jest.mock('../../main/utilities/brandLandingRoute', () => ({
    getHabitsLandingRouteName: (...args: any[]) => mockGetHabitsLandingRouteName(...args),
}));

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

const mockSyncMobileContacts = jest.fn().mockResolvedValue({ contacts: [], matchedUsers: [] });
jest.mock('../../main/utilities/contacts', () => ({
    synceMobileContacts: (...args: any[]) => mockSyncMobileContacts(...args),
}));

const mockMarkContactsSynced = jest.fn().mockResolvedValue({});
const mockMarkContactsSkipped = jest.fn().mockResolvedValue({});
const mockMarkInterestsSelected = jest.fn().mockResolvedValue({});
jest.mock('../../main/utilities/profileCompletion', () => ({
    markContactsSynced: (...args: any[]) => mockMarkContactsSynced(...args),
    markContactsSkipped: (...args: any[]) => mockMarkContactsSkipped(...args),
    markInterestsSelected: (...args: any[]) => mockMarkInterestsSelected(...args),
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
        goBack: jest.fn(),
        reset: jest.fn(),
        canGoBack: jest.fn().mockReturnValue(true),
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

describe('CreateProfile (HABITS onboarding)', () => {
    describe('Stage order', () => {
        it('drops the interests and phone stages that Habits does not use up front', () => {
            expect(getStageOrder()).toEqual(['details', 'picture', 'contacts']);
        });

        it('keeps the full order for Therr', () => {
            expect(getStageOrder('therr' as any)).toEqual(['details', 'interests', 'picture', 'phone', 'contacts']);
        });

        it('advances details → picture, skipping interests', async () => {
            const { ref } = renderCreateProfile(buildProps());
            await act(async () => {
                ref.current!.onSubmit('details');
                await Promise.resolve();
            });
            expect(ref.current!.state.stage).toBe('picture');
        });

        it('advances picture → contacts, skipping phone verification', () => {
            const { ref } = renderCreateProfile(buildProps({ route: { params: { stage: 'picture' } } }));
            act(() => { ref.current!.onContinue(); });
            expect(ref.current!.state.stage).toBe('contacts');
        });

        it('sizes the progress bar to the shorter flow', () => {
            const { ref } = renderCreateProfile(buildProps());
            expect(ref.current!.getStageStepNumber('details')).toBe(1);
            expect(ref.current!.getStageStepNumber('picture')).toBe(2);
            expect(ref.current!.getStageStepNumber('contacts')).toBe(3);
            expect(ref.current!.getStageStepNumber('invite')).toBe(3);
        });
    });

    describe('Just-in-time phone verification', () => {
        it('returns to the screen that asked (an SMS invite) once the number is verified', async () => {
            const props = buildProps({ route: { params: { stage: 'phone' } } });
            const { ref } = renderCreateProfile(props);
            act(() => { ref.current!.onPhoneInputChange('phoneNumber', '+15555555555', true); });
            await act(async () => {
                ref.current!.onSubmit('phone');
                await Promise.resolve();
            });
            expect(props.navigation.goBack).toHaveBeenCalled();
            expect(ref.current!.state.stage).toBe('phone');
        });
    });

    describe('Finishing onboarding', () => {
        it('resets to the Habits landing route instead of the Map route Habits does not have', async () => {
            const props = buildProps({ route: { params: { stage: 'invite' } } });
            const { ref } = renderCreateProfile(props);

            await act(async () => {
                ref.current!.onFinishOnboarding();
                await Promise.resolve();
            });

            expect(props.navigation.navigate).not.toHaveBeenCalledWith('Map');
            expect(props.navigation.reset).toHaveBeenCalledWith({
                index: 0,
                routes: [{ name: 'HabitsDashboard' }],
            });
        });

        it('lands on the one-time push opt-in when it has not been shown yet', async () => {
            mockGetHabitsLandingRouteName.mockResolvedValueOnce('HabitsPushOptIn');
            const props = buildProps({ route: { params: { stage: 'invite' } } });
            const { ref } = renderCreateProfile(props);

            await act(async () => {
                ref.current!.onFinishOnboarding();
                await Promise.resolve();
            });

            expect(props.navigation.reset).toHaveBeenCalledWith({
                index: 0,
                routes: [{ name: 'HabitsPushOptIn' }],
            });
        });
    });
});
