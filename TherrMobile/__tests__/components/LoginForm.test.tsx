import 'react-native';
import React from 'react';
import LoginForm from '../../main/routes/Login/LoginForm';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shiped with jest.
import {it} from '@jest/globals';

// The shared Button reads the active theme via useSelector. This test renders
// the form with explicit props (no <Provider>), so stub useSelector to resolve
// against a default state instead of requiring a store.
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: (selector: (state: any) => any) => selector({ user: { settings: {} } }),
}));

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
