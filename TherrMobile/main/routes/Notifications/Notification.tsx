import React from 'react';
import { GestureResponderEvent, Pressable, View } from 'react-native';
import { Button, Text } from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import formatDate from '../../utilities/formatDate';
import { ITherrThemeColors } from '../../styles/themes';

interface INotificationProps {
    acknowledgeRequest: any;
    containerStyles?: any;
    handlePress: ((event: GestureResponderEvent) => void) | undefined;
    handlePressAndNavigate: ((event: GestureResponderEvent) => void) | null | undefined;
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
    handlePressAndNavigate,
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
            onPress={handlePressAndNavigate}
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
                    notification.userConnection?.requestStatus === 'pending' &&
                    <View style={themeNotification.styles.actionsContainer}>
                        {
                            notification.messageParams?.userId &&
                            <Button
                                title={translate('components.notification.buttons.view')}
                                type="clear"
                                buttonStyle={themeNotification.styles.actionButton}
                                titleStyle={themeNotification.styles.actionButtonText}
                                icon={
                                    <FontAwesomeIcon
                                        name="eye"
                                        size={18}
                                    />
                                }
                                onPress={(e) => handlePressAndNavigate && handlePressAndNavigate(e)}
                            />
                        }
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
                <View style={themeNotification.styles.dateContainer}>
                    {/* eslint-disable-next-line max-len */}
                    <Text style={themeNotification.styles.dateText}>{formatDate(notification.createdAt, 'short').date} | {formatDate(notification.createdAt, 'short').time}</Text>
                </View>
            </View>
            <Pressable
                onPress={handlePress}
                style={themeNotification.styles.iconContainerStyle}
                hitSlop={20}
            >
                {
                    isUnread ?
                        <FontAwesomeIcon
                            name="dot-circle"
                            size={20}
                            style={iconStyle}
                        /> :
                        <FontAwesomeIcon
                            name="check"
                            size={14}
                            style={iconStyle}
                        />
                }
            </Pressable>
        </Pressable>
    );
};
