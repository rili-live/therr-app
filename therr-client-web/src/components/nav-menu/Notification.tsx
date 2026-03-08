import * as React from 'react';
import { MantineButton } from 'therr-react/components/mantine';
import { INotification } from 'therr-react/types';
import { UserConnectionTypes } from 'therr-js-utilities/constants';

// Regular component props
interface INotificationProps {
    key: number;
    notification: INotification;
    handleConnectionRequestAction: any;
    handleSetRead: any;
}

const Notification: React.FunctionComponent<INotificationProps> = ({
    notification,
    handleConnectionRequestAction,
    handleSetRead,
}: INotificationProps) => {
    const notificationClassNames = `notification ${!notification.isUnread ? 'read' : 'unread'}`;

    if (notification.type === 'CONNECTION_REQUEST_RECEIVED') {
        return (
            <div className={notificationClassNames} onClick={(e) => handleSetRead(e, notification)}>
                <div className="notification-content">
                    <span>{notification.message}</span>
                    {
                        notification.userConnection.requestStatus === UserConnectionTypes.PENDING
                        && <div className="action-buttons text-right">
                            <MantineButton
                                id="deny_connection_request_button"
                                className="action-button"
                                text="Deny"
                                onClick={(e) => handleConnectionRequestAction(e, notification, false)}
                                variant="outline"
                                size="compact-sm"
                            />
                            <MantineButton
                                id="accept_connection_request_button"
                                className="action-button"
                                text="Accept"
                                onClick={(e) => handleConnectionRequestAction(e, notification, true)}
                                size="compact-sm"
                            />
                        </div>
                    }
                </div>
            </div>
        );
    }

    return (
        <div className={notificationClassNames} onClick={(e) => handleSetRead(e, notification)}>
            <div className="notification-content">
                <span>{notification.message}</span>
            </div>
        </div>
    );
};

export default Notification;
