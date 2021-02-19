import React from 'react';
import { GestureResponderEvent, Pressable, Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { notification as notificationStyles } from '../../styles/notifications';
import * as therrTheme from '../../styles/themes';

interface INotificationProps {
    acknowledgeRequest: any;
    containerStyles?: any;
    handlePress: ((event: GestureResponderEvent) => void) | null | undefined;
    isUnread: boolean;
    notification: any;
    translate: any;
}

export default ({
    acknowledgeRequest,
    containerStyles,
    handlePress,
    isUnread,
    notification,
    translate,
}: INotificationProps) => {
    // Styles
    let rootStyle = isUnread ? notificationStyles.rootUnread : notificationStyles.rootRead;
    let messageContainerStyle = isUnread ? notificationStyles.messageContainerUnread : notificationStyles.messageContainerRead;
    let messageStyle = isUnread ? notificationStyles.unread : notificationStyles.read;
    let iconStyle = isUnread ? notificationStyles.iconUnread : notificationStyles.iconRead;

    return (
        <Pressable
            android_ripple={{
                color: therrTheme.colors.primary,
            }}
            onPress={handlePress}
            style={{
                ...rootStyle,
                ...(containerStyles || {}),
            }}
        >
            <View
                style={messageContainerStyle}
            >
                <Text style={messageStyle}>
                    {notification.message}
                </Text>
                {
                    isUnread ?
                        <FontAwesomeIcon
                            name="dot-circle"
                            size={14}
                            style={iconStyle}
                        /> :
                        <FontAwesomeIcon
                            name="check"
                            size={14}
                            style={iconStyle}
                        />
                }
            </View>
            {
                notification.userConnection.requestStatus === 'pending' &&
                <View style={notificationStyles.actionsContainer}>
                    <Button
                        title={translate('components.notification.buttons.accept')}
                        type="clear"
                        buttonStyle={notificationStyles.actionButton}
                        titleStyle={notificationStyles.actionButtonText}
                        icon={
                            <FontAwesomeIcon
                                name="check"
                                size={18}
                            />
                        }
                        onPress={(e) => acknowledgeRequest(e, notification, true)}
                    />
                    <Button
                        title={translate('components.notification.buttons.reject')}
                        type="clear"
                        buttonStyle={notificationStyles.actionButton}
                        titleStyle={notificationStyles.actionButtonText}
                        icon={
                            <FontAwesomeIcon
                                name="minus"
                                size={18}
                            />
                        }
                        onPress={(e) => acknowledgeRequest(e, notification, false)}
                    />
                </View>
            }
        </Pressable>
    );
};
