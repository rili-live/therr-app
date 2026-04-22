import 'react-native';
import React from 'react';
import LoginForm from '../../main/routes/Login/LoginForm';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shiped with jest.
import {it} from '@jest/globals';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

const mockStyles = {
    placeholderText: {
        color: 'white',
    },
};

describe('LoginForm', () => {
    beforeEach(() => {
    });

    it('renders correctly', () => {
        const mockNavigation = {
            navigate: jest.fn(),
        };
        const mockLogin = jest.fn();
        let component: renderer.ReactTestRenderer;
        act(() => {
            component = renderer.create(
                <LoginForm navigation={mockNavigation}
                    login={mockLogin}
                    userSettings={{ mobileThemeName: 'retro' }}
                    themeAuthForm={{ styles: mockStyles }}
                    themeAlerts={{ styles: mockStyles, colors: {} as any }}
                    themeForms={{ styles: mockStyles, colors: {} as any }}
                />
            );
        });
        expect(component!.getInstance()?.isLoginFormDisabled()).toEqual(true);
    });
});
