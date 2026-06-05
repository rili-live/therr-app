import 'react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { Button } from '../../main/components/BaseButton';
import CreateProfileInterests from '../../main/components/0_First_Time_UI/onboarding-stages/CreateProfileInterests';
import CreateProfileDetails from '../../main/components/0_First_Time_UI/onboarding-stages/CreateProfileDetails';
import CreateProfilePicture from '../../main/components/0_First_Time_UI/onboarding-stages/CreateProfilePicture';
import CreateProfilePhoneVerify from '../../main/components/0_First_Time_UI/onboarding-stages/CreateProfilePhoneVerify';
import { buildStyles } from '../../main/styles';
import { buildStyles as buildAlertStyles } from '../../main/styles/alerts';
import { buildStyles as buildFormStyles } from '../../main/styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../main/styles/forms/settingsForm';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');
jest.mock('lottie-react-native', () => 'LottieView');

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
    signImageUrl: jest.fn().mockResolvedValue({ data: { url: ['https://signed-url.com'] } }),
}));

jest.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn().mockResolvedValue(undefined),
}));

const mockVerifyPhone = jest.fn().mockResolvedValue({});
jest.mock('therr-react/services', () => ({
    ApiService: {
        verifyPhone: (...args: any[]) => mockVerifyPhone(...args),
        validateCode: jest.fn().mockResolvedValue({}),
    },
}));

jest.mock('react-native-toast-message', () => {
    const MockToast = () => null;
    MockToast.show = jest.fn();
    MockToast.hide = jest.fn();
    return { __esModule: true, default: MockToast };
});

const theme = buildStyles('light');
const themeAlerts = buildAlertStyles('light');
const themeForms = buildFormStyles('light');
const themeSettingsForm = buildSettingsFormStyles('light');

const mockStore = {
    getState: () => ({ user: { settings: { mobileThemeName: 'light' } } }),
    subscribe: () => () => {},
    dispatch: () => {},
};

const translate = (key: string) => key;

const renderWithStore = (element: React.ReactElement) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(<Provider store={mockStore as any}>{element}</Provider>);
    });
    return component!;
};

// The submit/CTA buttons in onboarding once regressed to a height-less style,
// rendering as a thin sliver that users struggled to tap. `buttonPrimary` carries
// the intended touch-target height; assert every onboarding CTA resolves to it.
const EXPECTED_BUTTON_HEIGHT = themeForms.styles.buttonPrimary.height;

const findButtonByTitle = (component: renderer.ReactTestRenderer, title: string) =>
    component.root.findAllByType(Button).find((node) => node.props.title === title);

const resolvedHeight = (button: any) => StyleSheet.flatten(button.props.buttonStyle)?.height;

const interestsFixture = () => ({
    'categories.sports': [
        { id: 'i1', categoryKey: 'categories.sports', emoji: '⚽', displayNameKey: 'interests.soccer' },
        { id: 'i2', categoryKey: 'categories.sports', emoji: '🏀', displayNameKey: 'interests.basketball' },
    ],
    'categories.music': [
        { id: 'i3', categoryKey: 'categories.music', emoji: '🎸', displayNameKey: 'interests.rock' },
    ],
});

const mockUser = {
    details: { id: 'user-123', firstName: 'Test', lastName: 'User' },
    settings: { mobileThemeName: 'light', locale: 'en-us' },
};

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

describe('CreateProfileInterests — submit gating', () => {
    const renderInterests = (props: any = {}) => {
        const ref = React.createRef<any>();
        const onSubmit = jest.fn();
        const component = renderWithStore(
            <CreateProfileInterests
                ref={ref}
                availableInterests={interestsFixture()}
                isLoading={false}
                isDisabled={false}
                onSubmit={onSubmit}
                translate={translate}
                theme={theme}
                themeForms={themeForms}
                themeSettingsForm={themeSettingsForm}
                submitButtonText="forms.createProfile.buttons.submit"
                {...props}
            />
        );
        return { ref, component, onSubmit };
    };

    const submitButton = (component: renderer.ReactTestRenderer) =>
        findButtonByTitle(component, 'forms.createProfile.buttons.submit');

    it('disables the submit button when no interest is selected', () => {
        const { component } = renderInterests();
        expect(submitButton(component)!.props.disabled).toBe(true);
    });

    it('enables the submit button once an interest is selected', () => {
        const { ref, component } = renderInterests();
        act(() => {
            ref.current.onPressInterest({ id: 'i1', categoryKey: 'categories.sports' });
        });
        expect(submitButton(component)!.props.disabled).toBe(false);
    });

    it('disables the submit button again after the last interest is deselected', () => {
        const { ref, component } = renderInterests();
        act(() => {
            ref.current.onPressInterest({ id: 'i1', categoryKey: 'categories.sports' });
        });
        expect(submitButton(component)!.props.disabled).toBe(false);
        act(() => {
            ref.current.onPressInterest({ id: 'i1', categoryKey: 'categories.sports' });
        });
        expect(submitButton(component)!.props.disabled).toBe(true);
    });

    it('keeps the submit button disabled while a submit is in flight, even with a selection', () => {
        const { ref, component } = renderInterests({ isDisabled: true });
        act(() => {
            ref.current.onPressInterest({ id: 'i1', categoryKey: 'categories.sports' });
        });
        expect(submitButton(component)!.props.disabled).toBe(true);
    });

    it('submits the selected interests as an array of toggles when pressed', () => {
        const { ref, component, onSubmit } = renderInterests();
        act(() => {
            ref.current.onPressInterest({ id: 'i1', categoryKey: 'categories.sports' });
        });
        act(() => {
            submitButton(component)!.props.onPress();
        });
        expect(onSubmit).toHaveBeenCalledTimes(1);
        const submitted = onSubmit.mock.calls[0][0];
        expect(submitted).toEqual(expect.arrayContaining([
            { interestId: 'i1', isEnabled: true },
            { interestId: 'i2', isEnabled: false },
            { interestId: 'i3', isEnabled: false },
        ]));
    });
});

describe('Onboarding CTAs render at the full touch-target height', () => {
    it('CreateProfileDetails submit button uses the primary height', () => {
        const component = renderWithStore(
            <CreateProfileDetails
                errorMsg=""
                inputs={{ userName: 'testuser', firstName: 'Test', lastName: 'User' }}
                isFormDisabled={false}
                onInputChange={jest.fn()}
                onPickerChange={jest.fn()}
                onSubmit={jest.fn()}
                translate={translate}
                theme={theme}
                themeAlerts={themeAlerts}
                themeForms={themeForms}
                themeSettingsForm={themeSettingsForm}
            />
        );
        const button = findButtonByTitle(component, 'forms.createProfile.buttons.submit');
        expect(resolvedHeight(button)).toBe(EXPECTED_BUTTON_HEIGHT);
    });

    it('CreateProfileInterests submit button uses the primary height', () => {
        const component = renderWithStore(
            <CreateProfileInterests
                availableInterests={interestsFixture()}
                isLoading={false}
                isDisabled={false}
                onSubmit={jest.fn()}
                translate={translate}
                theme={theme}
                themeForms={themeForms}
                themeSettingsForm={themeSettingsForm}
                submitButtonText="forms.createProfile.buttons.submit"
            />
        );
        const button = findButtonByTitle(component, 'forms.createProfile.buttons.submit');
        expect(resolvedHeight(button)).toBe(EXPECTED_BUTTON_HEIGHT);
    });

    it('CreateProfilePicture submit button uses the primary height', () => {
        const component = renderWithStore(
            <CreateProfilePicture
                user={mockUser}
                errorMsg=""
                isDisabled={false}
                requestUserUpdate={jest.fn()}
                onCropComplete={jest.fn()}
                onInputChange={jest.fn()}
                onContinue={jest.fn()}
                translate={translate}
                theme={theme}
                themeAlerts={themeAlerts}
                themeForms={themeForms}
                themeSettingsForm={themeSettingsForm}
                userImageUri="https://example.com/image.jpg"
            />
        );
        const button = findButtonByTitle(component, 'forms.createProfile.buttons.submit');
        expect(resolvedHeight(button)).toBe(EXPECTED_BUTTON_HEIGHT);
    });

    it('CreateProfilePhoneVerify phone-entry and verification-code buttons use the primary height', async () => {
        const ref = React.createRef<any>();
        const component = renderWithStore(
            <CreateProfilePhoneVerify
                ref={ref}
                user={mockUser}
                errorMsg=""
                isFormDisabled={false}
                onInputChange={jest.fn()}
                onSubmit={jest.fn()}
                translate={translate}
                theme={theme}
                themeAlerts={themeAlerts}
                themeForms={themeForms}
                themeSettingsForm={themeSettingsForm}
            />
        );

        // Phone-entry state CTA.
        const verifyButton = findButtonByTitle(component, 'forms.createProfile.buttons.verifyNow');
        expect(resolvedHeight(verifyButton)).toBe(EXPECTED_BUTTON_HEIGHT);

        // Advance to the verification-code entry state.
        await act(async () => {
            ref.current.onSubmitVerifyPhone();
            await Promise.resolve();
        });

        const submitCodeButton = findButtonByTitle(component, 'forms.createProfile.buttons.submitCode');
        expect(resolvedHeight(submitCodeButton)).toBe(EXPECTED_BUTTON_HEIGHT);
    });
});
