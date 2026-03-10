/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-test-renderer';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { LoginFormComponent } from '../LoginForm';

const mountWithProviders = (component: React.ReactElement) => mount(
    <MantineProvider>
        <MemoryRouter>
            {component}
        </MemoryRouter>
    </MantineProvider>,
);

const getComponent = (wrapper: ReactWrapper) => wrapper.find(LoginFormComponent);

describe('LoginForm', () => {
    const defaultProps = {
        login: jest.fn().mockResolvedValue({}),
        translate: (key: string) => key,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders without crashing', () => {
        const wrapper = mountWithProviders(<LoginFormComponent {...defaultProps} />);
        expect(getComponent(wrapper).length).toBe(1);
    });

    it('renders username and password inputs', () => {
        const wrapper = mountWithProviders(<LoginFormComponent {...defaultProps} />);
        expect(wrapper.find('input#user_name').length).toBe(1);
        expect(wrapper.find('input[name="password"]').length).toBe(1);
    });

    it('renders login button as disabled when fields are empty', () => {
        const wrapper = mountWithProviders(<LoginFormComponent {...defaultProps} />);
        const button = wrapper.find('button#login_button');
        expect(button.length).toBe(1);
        expect(button.prop('disabled')).toBe(true);
    });

    it('enables login button when both fields have values', () => {
        const wrapper = mountWithProviders(<LoginFormComponent {...defaultProps} />);
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.setState({
                inputs: { userName: 'testuser', password: 'testpass', rememberMe: true },
            });
        });
        wrapper.update();

        const button = wrapper.find('button#login_button');
        expect(button.prop('disabled')).toBeFalsy();
    });

    it('calls login prop on submit with credentials', () => {
        const loginFn = jest.fn().mockResolvedValue({});
        const wrapper = mountWithProviders(
            <LoginFormComponent {...defaultProps} login={loginFn} />,
        );
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.setState({
                inputs: { userName: 'testuser', password: 'testpass', rememberMe: true },
            });
        });
        wrapper.update();

        act(() => {
            instance.onSubmit({
                preventDefault: jest.fn(),
                target: { id: 'login_button' },
                currentTarget: { id: 'login_button' },
            });
        });

        expect(loginFn).toHaveBeenCalledWith({
            userName: 'testuser',
            password: 'testpass',
            rememberMe: true,
        });
    });

    it('lowercases username input', () => {
        const wrapper = mountWithProviders(<LoginFormComponent {...defaultProps} />);
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.onInputChange('userName', 'TestUser');
        });

        expect(instance.state.inputs.userName).toBe('testuser');
    });

    it('displays custom title when provided', () => {
        const wrapper = mountWithProviders(
            <LoginFormComponent {...defaultProps} title="Custom Title" />,
        );
        expect(wrapper.find('h1').text()).toBe('Custom Title');
    });

    it('displays default title when no title provided', () => {
        const wrapper = mountWithProviders(<LoginFormComponent {...defaultProps} />);
        // Should render the translated default title key
        expect(wrapper.find('h1').text()).toBeTruthy();
    });

    it('displays alert when alert prop is provided', () => {
        const wrapper = mountWithProviders(
            <LoginFormComponent {...defaultProps} alert="Test alert" alertVariation="success" />,
        );
        expect(wrapper.text()).toContain('Test alert');
    });

    it('hides alert when there is a login error', () => {
        const wrapper = mountWithProviders(
            <LoginFormComponent {...defaultProps} alert="Test alert" alertVariation="success" />,
        );
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.setState({ prevLoginError: 'Login failed' });
        });
        wrapper.update();

        expect(wrapper.text()).not.toContain('Test alert');
        expect(wrapper.text()).toContain('Login failed');
    });

    it('shows error message on login failure (401)', async () => {
        const loginFn = jest.fn().mockRejectedValue({
            statusCode: 401,
            message: 'Invalid credentials',
        });
        const wrapper = mountWithProviders(
            <LoginFormComponent {...defaultProps} login={loginFn} />,
        );
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.setState({
                inputs: { userName: 'testuser', password: 'wrongpass', rememberMe: true },
            });
        });
        wrapper.update();

        await act(async () => {
            instance.onSubmit({
                preventDefault: jest.fn(),
                target: { id: 'login_button' },
                currentTarget: { id: 'login_button' },
            });
        });
        wrapper.update();

        expect(instance.state.prevLoginError).toBe('Invalid credentials');
        expect(instance.state.isSubmitting).toBe(false);
    });

    it('shows translated error for rate limiting (429)', async () => {
        const loginFn = jest.fn().mockRejectedValue({
            statusCode: 429,
            message: 'Too many login attempts, please try again later.',
        });
        const wrapper = mountWithProviders(
            <LoginFormComponent {...defaultProps} login={loginFn} />,
        );
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.setState({
                inputs: { userName: 'testuser', password: 'pass', rememberMe: true },
            });
        });

        await act(async () => {
            instance.onSubmit({
                preventDefault: jest.fn(),
                target: { id: 'login_button' },
                currentTarget: { id: 'login_button' },
            });
        });

        // Should use translated key, not raw message
        expect(instance.state.prevLoginError).toBeTruthy();
        expect(instance.state.isSubmitting).toBe(false);
    });

    it('sets isSubmitting during login request', () => {
        const loginFn = jest.fn().mockReturnValue(new Promise(() => {}));
        const wrapper = mountWithProviders(
            <LoginFormComponent {...defaultProps} login={loginFn} />,
        );
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.setState({
                inputs: { userName: 'testuser', password: 'testpass', rememberMe: true },
            });
        });

        act(() => {
            instance.onSubmit({
                preventDefault: jest.fn(),
                target: { id: 'login_button' },
                currentTarget: { id: 'login_button' },
            });
        });

        expect(instance.state.isSubmitting).toBe(true);
    });

    it('does not call login when form is disabled', () => {
        const loginFn = jest.fn().mockResolvedValue({});
        const wrapper = mountWithProviders(
            <LoginFormComponent {...defaultProps} login={loginFn} />,
        );
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.onSubmit({
                preventDefault: jest.fn(),
                target: { id: 'login_button' },
                currentTarget: { id: 'login_button' },
            });
        });

        expect(loginFn).not.toHaveBeenCalled();
    });

    it('clears login error when input changes', () => {
        const wrapper = mountWithProviders(<LoginFormComponent {...defaultProps} />);
        const instance = getComponent(wrapper).instance() as any;

        act(() => {
            instance.setState({ prevLoginError: 'Some error' });
        });
        expect(instance.state.prevLoginError).toBe('Some error');

        act(() => {
            instance.onInputChange('userName', 'newuser');
        });
        expect(instance.state.prevLoginError).toBe('');
    });

    it('renders sign up and forgot password links', () => {
        const wrapper = mountWithProviders(<LoginFormComponent {...defaultProps} />);
        const links = wrapper.find('a');
        const hrefs = links.map((l) => l.prop('href'));
        expect(hrefs).toContain('/register');
        expect(hrefs).toContain('/reset-password');
    });
});
