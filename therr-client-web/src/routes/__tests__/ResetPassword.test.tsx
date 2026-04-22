/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-test-renderer';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordComponent } from '../ResetPassword';

const mountWithProviders = (component: React.ReactElement) => mount(
    <MantineProvider>
        <MemoryRouter>
            {component}
        </MemoryRouter>
    </MantineProvider>,
);

const getInstance = (wrapper: ReactWrapper) => wrapper.find(ResetPasswordComponent).instance() as any;

describe('ResetPassword', () => {
    const defaultProps = {
        navigation: { navigate: jest.fn() },
        translate: (key: string) => key,
    };

    it('renders without crashing', () => {
        const wrapper = mountWithProviders(<ResetPasswordComponent {...defaultProps} />);
        expect(wrapper.find(ResetPasswordComponent).length).toBe(1);
    });

    it('renders email input and submit button', () => {
        const wrapper = mountWithProviders(<ResetPasswordComponent {...defaultProps} />);
        expect(wrapper.find('input#email').length).toBe(1);
        expect(wrapper.find('button#email').length).toBe(1);
    });

    it('disables submit button when email is empty', () => {
        const wrapper = mountWithProviders(<ResetPasswordComponent {...defaultProps} />);
        const button = wrapper.find('button#email');
        expect(button.prop('disabled')).toBe(true);
    });

    it('enables submit button when email is provided', () => {
        const wrapper = mountWithProviders(<ResetPasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ email: 'test@test.com' });
        });
        wrapper.update();

        const button = wrapper.find('button#email');
        expect(button.prop('disabled')).toBeFalsy();
    });

    it('displays success message after email sent', () => {
        const wrapper = mountWithProviders(<ResetPasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ isEmailSent: true, errorReason: '' });
        });
        wrapper.update();

        expect(wrapper.text()).toContain('pages.resetPassword.successMessage');
    });

    it('displays error for user not found', () => {
        const wrapper = mountWithProviders(<ResetPasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ errorReason: 'UserNotFound' });
        });
        wrapper.update();

        expect(wrapper.text()).toContain('pages.resetPassword.failedMessageUserNotFound');
    });

    it('renders login link', () => {
        const wrapper = mountWithProviders(<ResetPasswordComponent {...defaultProps} />);
        const links = wrapper.find('a');
        const hrefs = links.map((l) => l.prop('href'));
        expect(hrefs).toContain('/login');
    });

    it('updates email state on input change', () => {
        const wrapper = mountWithProviders(<ResetPasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onInputChange('email', 'new@email.com');
        });

        expect(instance.state.email).toBe('new@email.com');
    });
});
