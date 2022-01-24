import React from 'react';
import { GestureResponderEvent, Pressable, Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ITherrThemeColors } from '../../styles/themes';

interface INotificationProps {
    acknowledgeRequest: any;
    containerStyles?: any;
    handlePress: ((event: GestureResponderEvent) => void) | null | undefined;
    isUnread: boolean;
    notification: any;
    translate: any;
    themeNotification: {
        colors: ITherrThemeColors
        styles: any;
    }
}

export default ({
    acknowledgeRequest,
    containerStyles,
    handlePress,
    isUnread,
    notification,
    translate,
    themeNotification,
}: INotificationProps) => {
    // Styles
    let rootStyle = isUnread ? themeNotification.styles.rootUnread : themeNotification.styles.rootRead;
    let messageContainerStyle = isUnread ? themeNotification.styles.messageContainerUnread : themeNotification.styles.messageContainerRead;
    let messageStyle = isUnread ? themeNotification.styles.unread : themeNotification.styles.read;
    let iconStyle = isUnread ? themeNotification.styles.iconUnread : themeNotification.styles.iconRead;

    return (
        <Pressable
            android_ripple={{
                color: themeNotification.colors.primary,
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
                notification.userConnection?.requestStatus === 'pending' &&
                <View style={themeNotification.styles.actionsContainer}>
                    <Button
                        title={translate('components.notification.buttons.accept')}
                        type="clear"
                        buttonStyle={themeNotification.styles.actionButton}
                        titleStyle={themeNotification.styles.actionButtonText}
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
                        buttonStyle={themeNotification.styles.actionButton}
                        titleStyle={themeNotification.styles.actionButtonText}
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
