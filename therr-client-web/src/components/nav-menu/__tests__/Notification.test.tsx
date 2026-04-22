/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { mount } from 'enzyme';
import { MantineProvider } from '@mantine/core';
import { UserConnectionTypes } from 'therr-js-utilities/constants';
import Notification from '../Notification';

const mountWithProviders = (component: React.ReactElement) => mount(
    <MantineProvider>
        {component}
    </MantineProvider>,
);

describe('Notification', () => {
    const mockHandleSetRead = jest.fn();
    const mockHandleConnectionRequest = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders a basic notification', () => {
        const notification = {
            id: 1,
            type: 'GENERAL',
            message: 'Test notification',
            isUnread: true,
        };

        const wrapper = mountWithProviders(
            <Notification
                key={1}
                notification={notification as any}
                handleSetRead={mockHandleSetRead}
                handleConnectionRequestAction={mockHandleConnectionRequest}
            />,
        );

        expect(wrapper.text()).toContain('Test notification');
    });

    it('applies unread class for unread notifications', () => {
        const notification = {
            id: 1,
            type: 'GENERAL',
            message: 'Unread notification',
            isUnread: true,
        };

        const wrapper = mountWithProviders(
            <Notification
                key={1}
                notification={notification as any}
                handleSetRead={mockHandleSetRead}
                handleConnectionRequestAction={mockHandleConnectionRequest}
            />,
        );

        expect(wrapper.find('.unread').length).toBeGreaterThan(0);
    });

    it('applies read class for read notifications', () => {
        const notification = {
            id: 1,
            type: 'GENERAL',
            message: 'Read notification',
            isUnread: false,
        };

        const wrapper = mountWithProviders(
            <Notification
                key={1}
                notification={notification as any}
                handleSetRead={mockHandleSetRead}
                handleConnectionRequestAction={mockHandleConnectionRequest}
            />,
        );

        expect(wrapper.find('.read').length).toBeGreaterThan(0);
    });

    it('calls handleSetRead when notification is clicked', () => {
        const notification = {
            id: 1,
            type: 'GENERAL',
            message: 'Test notification',
            isUnread: true,
        };

        const wrapper = mountWithProviders(
            <Notification
                key={1}
                notification={notification as any}
                handleSetRead={mockHandleSetRead}
                handleConnectionRequestAction={mockHandleConnectionRequest}
            />,
        );

        wrapper.find('.notification').simulate('click');
        expect(mockHandleSetRead).toHaveBeenCalled();
    });

    it('renders accept/deny buttons for pending connection requests', () => {
        const notification = {
            id: 1,
            type: 'CONNECTION_REQUEST_RECEIVED',
            message: 'Connection request from User',
            isUnread: true,
            userConnection: {
                requestStatus: UserConnectionTypes.PENDING,
            },
        };

        const wrapper = mountWithProviders(
            <Notification
                key={1}
                notification={notification as any}
                handleSetRead={mockHandleSetRead}
                handleConnectionRequestAction={mockHandleConnectionRequest}
            />,
        );

        expect(wrapper.find('button#deny_connection_request_button').length).toBe(1);
        expect(wrapper.find('button#accept_connection_request_button').length).toBe(1);
    });

    it('does not render action buttons for non-pending connection requests', () => {
        const notification = {
            id: 1,
            type: 'CONNECTION_REQUEST_RECEIVED',
            message: 'Connection request from User',
            isUnread: false,
            userConnection: {
                requestStatus: UserConnectionTypes.COMPLETE,
            },
        };

        const wrapper = mountWithProviders(
            <Notification
                key={1}
                notification={notification as any}
                handleSetRead={mockHandleSetRead}
                handleConnectionRequestAction={mockHandleConnectionRequest}
            />,
        );

        expect(wrapper.find('button#deny_connection_request_button').length).toBe(0);
        expect(wrapper.find('button#accept_connection_request_button').length).toBe(0);
    });

    it('calls handleConnectionRequestAction with false when deny is clicked', () => {
        const notification = {
            id: 1,
            type: 'CONNECTION_REQUEST_RECEIVED',
            message: 'Connection request',
            isUnread: true,
            userConnection: {
                requestStatus: UserConnectionTypes.PENDING,
            },
        };

        const wrapper = mountWithProviders(
            <Notification
                key={1}
                notification={notification as any}
                handleSetRead={mockHandleSetRead}
                handleConnectionRequestAction={mockHandleConnectionRequest}
            />,
        );

        wrapper.find('button#deny_connection_request_button').simulate('click');
        expect(mockHandleConnectionRequest).toHaveBeenCalledWith(
            expect.anything(),
            notification,
            false,
        );
    });

    it('calls handleConnectionRequestAction with true when accept is clicked', () => {
        const notification = {
            id: 1,
            type: 'CONNECTION_REQUEST_RECEIVED',
            message: 'Connection request',
            isUnread: true,
            userConnection: {
                requestStatus: UserConnectionTypes.PENDING,
            },
        };

        const wrapper = mountWithProviders(
            <Notification
                key={1}
                notification={notification as any}
                handleSetRead={mockHandleSetRead}
                handleConnectionRequestAction={mockHandleConnectionRequest}
            />,
        );

        wrapper.find('button#accept_connection_request_button').simulate('click');
        expect(mockHandleConnectionRequest).toHaveBeenCalledWith(
            expect.anything(),
            notification,
            true,
        );
    });
});
