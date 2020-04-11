import * as React from 'react';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary.js';
import { INotification } from 'types/notifications';

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
                <span>{notification.message}</span>
                {
                    notification.userConnection.requestStatus === 'pending'
                    && <div className="action-buttons text-right">
                        <ButtonPrimary
                            id="deny_connection_request_button"
                            className="action-button"
                            name="Deny"
                            text="Deny"
                            onClick={(e) => handleConnectionRequestAction(e, notification, false)}
                            buttonType="primary"
                        />
                        <ButtonPrimary
                            id="accept_connection_request_button"
                            className="action-button"
                            name="Accept"
                            text="Accept"
                            onClick={(e) => handleConnectionRequestAction(e, notification, true)}
                            buttonType="primary"
                        />
                    </div>
                }
            </div>
        );
    }

    return (
        <div className={notificationClassNames} onClick={(e) => handleSetRead(e, notification)}>
            <span>{notification.message}</span>
        </div>
    );
};

export default Notification;
