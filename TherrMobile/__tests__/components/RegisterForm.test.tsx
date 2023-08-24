import 'react-native';
import React from 'react';
import { buildStyles as buildAlertStyles } from '../../main/styles/alerts';
import { buildStyles as buildFormStyles } from '../../main/styles/forms';
import RegisterForm from '../../main/routes/Register/RegisterForm';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

// Note: import explicitly to use the types shiped with jest.
import {it} from '@jest/globals';

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

describe('RegisterForm', () => {
    beforeEach(() => {
    });

    it('renders correctly', () => {
        const mockLogin = jest.fn();
        const mockRegister = jest.fn();
        const mockToggleEULA = jest.fn();
        const onSuccessMock = jest.fn();
        const component = renderer.create(
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
        const instance = component.getInstance();
        expect(instance.isRegisterFormDisabled()).toEqual(true);
        instance.onInputChange('password', 'mockPassword');
        instance.onInputChange('repeatPassword', 'mockPassword2');
        expect(instance.isFormValid()).toEqual(false);
        expect(instance.state.passwordErrorMessage).toEqual('Passwords do not match');
        instance.onInputChange('repeatPassword', 'mockPassword');
        expect(instance.isFormValid()).toEqual(true);
        expect(instance.state.passwordErrorMessage.length).toEqual(0);
    });
});
