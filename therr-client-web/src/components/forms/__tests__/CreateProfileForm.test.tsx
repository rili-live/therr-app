/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-test-renderer';
import { MantineProvider } from '@mantine/core';
import { CreateProfileFormComponent } from '../CreateProfileForm';

const mountWithProviders = (component: React.ReactElement) => mount(
    <MantineProvider>
        {component}
    </MantineProvider>,
);

const getInstance = (wrapper: ReactWrapper) => wrapper.find(CreateProfileFormComponent).instance() as any;

describe('CreateProfileForm', () => {
    const defaultProps = {
        isSubmitting: false,
        onSubmit: jest.fn(),
        title: 'Create Profile',
        translate: (key: string) => key,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders without crashing', () => {
        const wrapper = mountWithProviders(<CreateProfileFormComponent {...defaultProps} />);
        expect(wrapper.find(CreateProfileFormComponent).length).toBe(1);
    });

    it('renders username, first name, and last name inputs', () => {
        const wrapper = mountWithProviders(<CreateProfileFormComponent {...defaultProps} />);
        expect(wrapper.find('input#user_name').length).toBe(1);
        expect(wrapper.find('input#first_name').length).toBe(1);
        expect(wrapper.find('input#last_name').length).toBe(1);
    });

    it('renders phone input', () => {
        const wrapper = mountWithProviders(<CreateProfileFormComponent {...defaultProps} />);
        // PhoneInput renders its own input inside the form
        expect(wrapper.find('input[type="tel"]').length).toBe(1);
    });

    it('renders submit button', () => {
        const wrapper = mountWithProviders(<CreateProfileFormComponent {...defaultProps} />);
        const button = wrapper.find('button#register');
        expect(button.length).toBe(1);
    });

    it('displays title', () => {
        const wrapper = mountWithProviders(
            <CreateProfileFormComponent {...defaultProps} title="My Profile" />,
        );
        expect(wrapper.find('h1').text()).toBe('My Profile');
    });

    it('lowercases username input', () => {
        const wrapper = mountWithProviders(<CreateProfileFormComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onInputChange('userName', 'TestUser');
        });

        expect(instance.state.inputs.userName).toBe('testuser');
    });

    it('updates input state on change', () => {
        const wrapper = mountWithProviders(<CreateProfileFormComponent {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onInputChange('firstName', 'John');
        });
        act(() => {
            instance.onInputChange('lastName', 'Doe');
        });

        expect(instance.state.inputs.firstName).toBe('John');
        expect(instance.state.inputs.lastName).toBe('Doe');
    });

    it('disables submit button when username is missing', () => {
        const wrapper = mountWithProviders(<CreateProfileFormComponent {...defaultProps} />);
        const button = wrapper.find('button#register');
        expect(button.prop('disabled')).toBe(true);
    });

    it('disables submit button when isSubmitting is true', () => {
        const wrapper = mountWithProviders(
            <CreateProfileFormComponent {...defaultProps} isSubmitting={true} />,
        );
        const button = wrapper.find('button#register');
        expect(button.prop('disabled')).toBe(true);
    });
});
