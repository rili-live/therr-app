import * as React from 'react';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary.js';
import { INotification } from 'types/notifications';

// Regular component props
interface INotificationProps {
    key: number;
    notification: INotification;
    handleAcceptConnectionRequest: any;
    handleSetRead: any;
}

const Notification: React.FunctionComponent<INotificationProps> = ({
    notification,
    handleAcceptConnectionRequest,
    handleSetRead,
}: INotificationProps) => {
    let message = notification.message;

    if (notification.messageParams && Object.keys(notification.messageParams).length) {
        Object.keys(notification.messageParams).forEach((key) => {
            message = message.replace(`{{${key}}}`, notification.messageParams[key]);
        });
    }

    if (notification.type === 'CONNECTION_REQUEST_RECEIVED') {
        return (
            <div className="notification" onClick={(e) => handleSetRead(e, notification)}>
                <span>{message}</span>
                {
                    notification.userConnection.requestStatus === 'pending'
                    && <div className="action-buttons text-right">
                        <ButtonPrimary
                            className="action-button"
                            name="Accept"
                            text="Accept"
                            onClick={(e) => handleAcceptConnectionRequest(e, notification)}
                            buttonType="primary"
                        />
                    </div>
                }
            </div>
        );
    }

    return (
        <div className="notification" onClick={(e) => handleSetRead(e, notification)}>
            <span>{message}</span>
        </div>
    );
};

export default Notification;
