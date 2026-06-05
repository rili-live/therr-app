import 'react-native';
import React from 'react';
import { buildStyles as buildAlertStyles } from '../../main/styles/alerts';
import { buildStyles as buildFormStyles } from '../../main/styles/forms';
import RegisterForm from '../../main/routes/Register/RegisterForm';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shiped with jest.
import {it} from '@jest/globals';

// The shared Button reads the active theme via useSelector. These tests render
// the form with explicit props (no <Provider>), so stub useSelector to resolve
// against a default state instead of requiring a store.
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: (selector: (state: any) => any) => selector({ user: { settings: {} } }),
}));

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');
jest.mock('react-native-date-picker', () => 'DatePicker');

const themeAlerts = buildAlertStyles();
const themeForms = buildFormStyles();

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

describe('RegisterForm', () => {
    beforeEach(() => {
    });

    it('renders correctly', () => {
        const mockLogin = jest.fn();
        const mockRegister = jest.fn();
        const mockToggleEULA = jest.fn();
        const onSuccessMock = jest.fn();
        let component: renderer.ReactTestRenderer;
        act(() => {
            component = renderer.create(
                <RegisterForm
                    login={mockLogin}
                    register={mockRegister}
                    onSuccess={onSuccessMock}
                    toggleEULA={mockToggleEULA}
                    userSettings={{ mobileThemeName: 'retro' }}
                    theme={{ styles: {} }}
                    themeAuthForm={{ styles: {} }}
                    themeAlerts={themeAlerts}
                    themeForms={themeForms}
                />
            );
        });
        const instance = component!.getInstance();
        expect(instance.isRegisterFormDisabled()).toEqual(true);
        act(() => { instance.onInputChange('password', 'mockPassword'); });
        act(() => { instance.onInputChange('repeatPassword', 'mockPassword2'); });
        expect(instance.isFormValid()).toEqual(false);
        expect(instance.state.passwordErrorMessage).toEqual('Passwords do not match');
        act(() => { instance.onInputChange('repeatPassword', 'mockPassword'); });
        expect(instance.isFormValid()).toEqual(true);
        expect(instance.state.passwordErrorMessage.length).toEqual(0);
    });
});
