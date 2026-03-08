/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-test-renderer';
import { MantineProvider } from '@mantine/core';
import CreateConnectionForm from '../CreateConnectionForm';

// Mock MantineSelect to avoid Mantine Combobox/Popover hanging in jsdom
jest.mock('therr-react/components/mantine', () => {
    const actual = jest.requireActual('therr-react/components/mantine');
    return {
        ...actual,
        MantineSelect: ({
            id, name, value, onChange, data, placeholder,
        }: any) => (
            <select
                id={id}
                name={name}
                value={value || ''}
                onChange={(e: any) => onChange(e.target.value || null)}
            >
                <option value="">{placeholder}</option>
                {data?.map((item: any) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                ))}
            </select>
        ),
    };
});

const mountWithProviders = (component: React.ReactElement) => mount(
    <MantineProvider>
        {component}
    </MantineProvider>,
);

const getInstance = (wrapper: ReactWrapper) => wrapper.find(CreateConnectionForm).instance() as any;

describe('CreateConnectionForm', () => {
    const defaultProps = {
        createUserConnection: jest.fn().mockResolvedValue({}),
        user: {
            details: {
                id: 'user-123',
                firstName: 'Test',
                lastName: 'User',
                email: 'test@test.com',
                userName: 'testuser',
            },
        } as any,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders without crashing', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        expect(wrapper.find(CreateConnectionForm).length).toBe(1);
    });

    it('renders a select dropdown for connection identifier', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        expect(wrapper.find('select#connection_identifier').length).toBe(1);
    });

    it('renders send button', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const button = wrapper.find('button#send_request');
        expect(button.length).toBe(1);
    });

    it('shows email input when email identifier selected', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onSelectChange('acceptingUserEmail');
        });
        wrapper.update();

        expect(wrapper.find('input#email').length).toBe(1);
    });

    it('shows phone input when phone identifier selected', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onSelectChange('acceptingUserPhoneNumber');
        });
        wrapper.update();

        // PhoneInput renders a tel input field
        expect(wrapper.find('input[type="tel"]').length).toBe(1);
    });

    it('onSelectChange updates connectionIdentifier', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onSelectChange('acceptingUserEmail');
        });

        expect(instance.state.inputs.connectionIdentifier).toBe('acceptingUserEmail');
    });

    it('onSelectChange with null resets to empty string', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onSelectChange(null);
        });

        expect(instance.state.inputs.connectionIdentifier).toBe('');
    });

    it('onValidateInput correctly tracks validation state', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.onValidateInput({ email: 'Email is required' });
        });
        expect(instance.state.hasValidationErrors).toBe(true);

        act(() => {
            instance.onValidateInput({});
        });
        expect(instance.state.hasValidationErrors).toBe(false);
    });

    it('displays success message after successful request', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ prevRequestSuccess: 'Connection sent!' });
        });
        wrapper.update();

        expect(wrapper.text()).toContain('Connection sent!');
    });

    it('displays error message after failed request', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({ prevRequestError: 'User not found' });
        });
        wrapper.update();

        expect(wrapper.text()).toContain('User not found');
    });

    it('lowercases email input when email identifier is selected', () => {
        const wrapper = mountWithProviders(<CreateConnectionForm {...defaultProps} />);
        const instance = getInstance(wrapper);

        act(() => {
            instance.setState({
                inputs: { ...instance.state.inputs, connectionIdentifier: 'acceptingUserEmail' },
            });
        });

        act(() => {
            instance.onInputChange('email', 'Test@Email.COM');
        });

        expect(instance.state.inputs.email).toBe('test@email.com');
    });
});
