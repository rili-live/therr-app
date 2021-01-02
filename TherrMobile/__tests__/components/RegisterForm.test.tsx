import 'react-native';
import React from 'react';
import RegisterForm from '../../main/components/RegisterForm';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');

beforeEach(() => {
    jest.useFakeTimers();
});

describe('RegisterForm', () => {
    beforeEach(() => {
    });

    it('renders correctly', () => {
        const mockRegister = jest.fn();
        const onSuccessMock = jest.fn();
        const component = renderer.create(<RegisterForm register={mockRegister} onSuccess={onSuccessMock} />);
        expect(component.getInstance().isRegisterFormDisabled()).toEqual(true);
    });
});
