import 'react-native';
import React from 'react';
import RegisterForm from '../../main/routes/Register/RegisterForm';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');

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
        const mockRegister = jest.fn();
        const mockToggleEULA = jest.fn();
        const onSuccessMock = jest.fn();
        const component = renderer.create(
            <RegisterForm register={mockRegister} onSuccess={onSuccessMock} toggleEULA={mockToggleEULA} userSettings={{ mobileThemeName: 'retro' }} />
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
