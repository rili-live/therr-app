/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-test-renderer';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { RegisterFormComponent } from '../RegisterForm';

const mountWithProviders = (component: React.ReactElement) => mount(
    <MantineProvider>
        <MemoryRouter>
            {component}
        </MemoryRouter>
    </MantineProvider>,
);

const getInstance = (wrapper: ReactWrapper) => wrapper.find(RegisterFormComponent).instance() as any;

describe('RegisterForm', () => {
    const defaultProps = {
        register: jest.fn(),
        title: 'Register',
        translate: (key: string) => key,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders without crashing', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        expect(wrapper.find(RegisterFormComponent).length).toBe(1);
    });

    it('renders email, password, and repeat password inputs', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        expect(wrapper.find('input#e_mail').length).toBe(1);
        expect(wrapper.find('input[name="password"]').length).toBe(1);
        expect(wrapper.find('input[name="repeatPassword"]').length).toBe(1);
    });

    it('renders checkbox inputs for newsletter and terms', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        expect(wrapper.find('input#newsletter').length).toBe(1);
        expect(wrapper.find('input#terms_and_conditions').length).toBe(1);
    });

    it('renders register button as disabled when fields are empty', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        const button = wrapper.find('button#register');
        expect(button.length).toBe(1);
        expect(button.prop('disabled')).toBe(true);
    });

    it('enables register button when all required fields are filled', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({
                inputs: {
                    email: 'test@test.com',
                    password: 'TestPass123!',
                    repeatPassword: 'TestPass123!',
                    hasAgreedToTerms: true,
                    settingsEmailMarketing: true,
                },
            });
        });
        wrapper.update();

        const button = wrapper.find('button#register');
        expect(button.prop('disabled')).toBeFalsy();
    });

    it('keeps button disabled when passwords do not match', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({
                inputs: {
                    email: 'test@test.com',
                    password: 'TestPass123!',
                    repeatPassword: 'DifferentPass123!',
                    hasAgreedToTerms: true,
                    settingsEmailMarketing: true,
                },
            });
        });
        wrapper.update();

        const button = wrapper.find('button#register');
        expect(button.prop('disabled')).toBe(true);
    });

    it('keeps button disabled when terms not agreed', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({
                inputs: {
                    email: 'test@test.com',
                    password: 'TestPass123!',
                    repeatPassword: 'TestPass123!',
                    hasAgreedToTerms: false,
                    settingsEmailMarketing: true,
                },
            });
        });
        wrapper.update();

        const button = wrapper.find('button#register');
        expect(button.prop('disabled')).toBe(true);
    });

    it('calls register prop on submit with credentials', () => {
        const registerFn = jest.fn();
        const wrapper = mountWithProviders(
            <RegisterFormComponent {...defaultProps} register={registerFn} />,
        );
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({
                inputs: {
                    email: 'test@test.com',
                    password: 'TestPass123!',
                    repeatPassword: 'TestPass123!',
                    hasAgreedToTerms: true,
                    settingsEmailMarketing: true,
                },
            });
        });

        act(() => {
            instance.onSubmit();
        });

        expect(registerFn).toHaveBeenCalledWith({
            email: 'test@test.com',
            password: 'TestPass123!',
            hasAgreedToTerms: true,
            settingsEmailMarketing: true,
        });
        // repeatPassword should be removed
        expect(registerFn.mock.calls[0][0]).not.toHaveProperty('repeatPassword');
    });

    it('does not call register when form is disabled', () => {
        const registerFn = jest.fn();
        const wrapper = mountWithProviders(
            <RegisterFormComponent {...defaultProps} register={registerFn} />,
        );
        const instance = getInstance(wrapper);

        act(() => {
            instance.onSubmit();
        });

        expect(registerFn).not.toHaveBeenCalled();
    });

    it('lowercases username input', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onInputChange('userName', 'TestUser');
        });

        expect(instance.state.inputs.userName).toBe('testuser');
    });

    it('toggles checkbox state on change', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        expect(instance.state.inputs.settingsEmailMarketing).toBe(true);

        act(() => {
            instance.onCheckboxChange({
                currentTarget: { name: 'settingsEmailMarketing' },
            });
        });

        expect(instance.state.inputs.settingsEmailMarketing).toBe(false);
    });

    it('displays invite code message when provided', () => {
        const wrapper = mountWithProviders(
            <RegisterFormComponent {...defaultProps} inviteCode="user123" />,
        );
        expect(wrapper.find('h4').length).toBe(1);
    });

    it('renders honeypot field hidden', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        const honeypot = wrapper.find('input#sweety_pie');
        expect(honeypot.length).toBe(1);
    });

    it('renders login link', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        const links = wrapper.find('a');
        const hrefs = links.map((l) => l.prop('href'));
        expect(hrefs).toContain('/login');
    });

    it('renders terms link', () => {
        const wrapper = mountWithProviders(<RegisterFormComponent {...defaultProps} />);
        expect(wrapper.find('a[href="https://www.therr.app/terms-and-conditions.html"]').length).toBe(1);
    });

    it('displays title', () => {
        const wrapper = mountWithProviders(
            <RegisterFormComponent {...defaultProps} title="Sign Up" />,
        );
        expect(wrapper.find('h1').text()).toBe('Sign Up');
    });
});
