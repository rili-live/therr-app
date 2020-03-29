import * as React from 'react';
import { INotification } from 'types/notifications';

// Regular component props
interface INotificationProps {
    key: number;
    notification: INotification;
}

const Notification: React.FunctionComponent<INotificationProps> = ({
    notification,
}: INotificationProps) => {
    let message = notification.message;

    if (notification.messageParams && Object.keys(notification.messageParams).length) {
        Object.keys(notification.messageParams).forEach((key) => {
            message = message.replace(`{{${key}}}`, notification.messageParams[key]);
        });
    }
    return (
        <div className="notification">
            {message}
        </div>
    );
};

export default Notification;
