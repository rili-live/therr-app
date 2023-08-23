import 'react-native';
// import React from 'react';
// import { Settings } from '../../main/routes/Settings';

// Note: test renderer must be required after react-native.
// import renderer from 'react-test-renderer';
// Note: import explicitly to use the types shiped with jest.
import {it} from '@jest/globals';

jest.mock('react-native-keyboard-aware-scroll-view');
jest.mock('../../main/components/ButtonMenu/MainButtonMenu');

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

describe('Settings', () => {
    it('renders correctly', () => {
        // const mockNavigation = {
        //     navigate: jest.fn(),
        //     setOptions: jest.fn(),
        // };
        // const mockUser = {
        //     details: {
        //         email: 'mock@email.com',
        //         phoneNumber: '+15555555555',
        //         firstName: 'mockFirstName',
        //         lastName: 'mockLastName',
        //         userName: 'mockUserName',
        //     },
        // };
        // const mockUpdateUser = jest.fn();
        // const component = renderer.create(<Settings navigation={mockNavigation} user={mockUser} updateUser={mockUpdateUser} />);
        // expect(mockNavigation.setOptions).toHaveBeenCalled();
        // const instance = component.getInstance();
        // expect(instance.isFormDisabled()).toEqual(false);
        // instance.onInputChange('oldPassword', 'mockPassword');
        // instance.onInputChange('password', 'mockNewPassword');
        // instance.onInputChange('repeatPassword', 'mockNewPassword2');
        // expect(instance.isFormDisabled()).toEqual(true);
        // expect(instance.state.passwordErrorMessage).toEqual('Passwords do not match');

        // instance.onInputChange('repeatPassword', 'mockNewPassword');
        // expect(instance.isFormDisabled()).toEqual(false);
        // expect(instance.state.passwordErrorMessage.length).toEqual(0);

        // instance.onInputChange('userName', '');
        // expect(instance.isFormDisabled()).toEqual(true);
    });
});
