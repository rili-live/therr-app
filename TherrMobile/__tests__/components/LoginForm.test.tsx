import 'react-native';
import React from 'react';
import LoginForm from '../../main/routes/Login/LoginForm';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

describe('LoginForm', () => {
    beforeEach(() => {
    });

    it('renders correctly', () => {
        const mockNavigatoin = {
            navigate: jest.fn(),
        };
        const mockLogin = jest.fn();
        const component = renderer.create(<LoginForm navigation={mockNavigatoin} login={mockLogin} />);
        expect(component.getInstance().isLoginFormDisabled()).toEqual(true);
    });
});
