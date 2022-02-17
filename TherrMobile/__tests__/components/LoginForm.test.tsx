import 'react-native';
import React from 'react';
import LoginForm from '../../main/routes/Login/LoginForm';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

describe('LoginForm', () => {
    beforeEach(() => {
    });

    it('renders correctly', () => {
        const mockNavigation = {
            navigate: jest.fn(),
        };
        const mockLogin = jest.fn();
        const component = renderer.create(
            <LoginForm navigation={mockNavigation}
                login={mockLogin}
                userSettings={{ mobileThemeName: 'retro' }}
                themeAuthForm={{ styles: {} }}
                themeAlerts={{ styles: {}, colors: {} }}
                themeForms={{ styles: {}, colors: {} }}
            />
        );
        expect(component.getInstance().isLoginFormDisabled()).toEqual(true);
    });
});
