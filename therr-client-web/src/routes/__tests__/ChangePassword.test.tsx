/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-test-renderer';
import { MantineProvider } from '@mantine/core';
import { ChangePasswordComponent } from '../ChangePassword';

const mountWithProviders = (component: React.ReactElement) => mount(
    <MantineProvider>
        {component}
    </MantineProvider>,
);

const getInstance = (wrapper: ReactWrapper) => wrapper.find(ChangePasswordComponent).instance() as any;

describe('ChangePassword', () => {
    const defaultProps = {
        user: {
            details: {
                email: 'test@test.com',
                userName: 'testuser',
            },
        } as any,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders without crashing', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        expect(wrapper.find(ChangePasswordComponent).length).toBe(1);
    });

    it('renders three password inputs', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        expect(wrapper.find('input[name="oldPassword"]').length).toBe(1);
        expect(wrapper.find('input[name="newPassword"]').length).toBe(1);
        expect(wrapper.find('input[name="newPasswordRepeat"]').length).toBe(1);
    });

    it('renders submit button as disabled when fields are empty', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        const button = wrapper.find('button#email');
        expect(button.length).toBe(1);
        expect(button.prop('disabled')).toBe(true);
    });

    it('enables submit button when all fields filled and passwords match', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({
                inputs: {
                    oldPassword: 'oldpass',
                    newPassword: 'newpass123',
                    newPasswordRepeat: 'newpass123',
                },
            });
        });
        wrapper.update();

        const button = wrapper.find('button#email');
        expect(button.prop('disabled')).toBeFalsy();
    });

    it('keeps submit disabled when new passwords do not match', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({
                inputs: {
                    oldPassword: 'oldpass',
                    newPassword: 'newpass123',
                    newPasswordRepeat: 'differentpass',
                },
            });
        });
        wrapper.update();

        const button = wrapper.find('button#email');
        expect(button.prop('disabled')).toBe(true);
    });

    it('displays success message on successful change', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ isSuccess: true, errorReason: '' });
        });
        wrapper.update();

        expect(wrapper.text()).toContain('Your password has been updated!');
    });

    it('displays error for incorrect password', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ errorReason: 'IncorrectPassword' });
        });
        wrapper.update();

        expect(wrapper.text()).toContain('The password you entered is incorrect.');
    });

    it('displays error for user not found', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ errorReason: 'UserNotFound' });
        });
        wrapper.update();

        expect(wrapper.text()).toContain('No user found. Logout and try again.');
    });

    it('clears error when input changes', () => {
        const wrapper = mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ errorReason: 'SomeError' });
        });
        expect(instance.state.errorReason).toBe('SomeError');

        act(() => {
            instance.onInputChange('oldPassword', 'test');
        });
        expect(instance.state.errorReason).toBe('');
    });

    it('sets document title on mount', () => {
        mountWithProviders(<ChangePasswordComponent {...defaultProps} />);
        expect(document.title).toContain('Therr');
    });
});
