import React from 'react';
import { GestureResponderEvent, Pressable, Text, View } from 'react-native';
import { Notifications as NotificationEnums } from 'therr-js-utilities/constants';
import { Button } from '../../components/BaseButton';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import formatDate from '../../utilities/formatDate';
import { ITherrThemeColors } from '../../styles/themes';

interface IMessageSegment {
    text: string;
    highlighted: boolean;
}

const getHighlightValues = (notification: any): string[] => {
    const values: string[] = [];
    const params = notification.messageParams;
    const type = notification.type;

    console.log(params)

    // Add dynamic param values (user names, group names, counts, etc.)
    if (params) {
        if (params.firstName && params.lastName) {
            values.push(`${params.firstName} ${params.lastName}`);
        } else {
            if (params.firstName) values.push(params.firstName);
            if (params.lastName) values.push(params.lastName);
        }
        if (params.userName) values.push(params.userName);
        if (params.inviterUserName) values.push(params.inviterUserName);
        if (params.fromUserName) values.push(params.fromUserName);
        if (params.members) values.push(params.members);
        if (params.groupName) values.push(params.groupName);
        if (params.totalAreasActivated) values.push(String(params.totalAreasActivated));
    }

    // Add type-specific action keywords that indicate routing destination
    // Include both English and Spanish variants for locale support
    if (type === NotificationEnums.Types.ACHIEVEMENT_COMPLETED) {
        values.push('claim your reward', 'Reclama tu recompensa');
    } else if (type === NotificationEnums.Types.CONNECTION_REQUEST_ACCEPTED) {
        values.push('connection request', 'solicitud de conexión');
    } else if (type === NotificationEnums.Types.CONNECTION_REQUEST_RECEIVED) {
        values.push('connection request', 'solicitud de conexión');
    } else if (type === NotificationEnums.Types.NEW_LIKE_RECEIVED
        || type === NotificationEnums.Types.NEW_SUPER_LIKE_RECEIVED) {
        values.push('your post', 'tu publicación');
    } else if (type === NotificationEnums.Types.THOUGHT_REPLY) {
        values.push('new replies', 'nuevas respuestas');
    } else if (type === NotificationEnums.Types.NEW_DM_RECEIVED) {
        values.push('direct message', 'mensaje directo');
    } else if (type === NotificationEnums.Types.NEW_GROUP_INVITE) {
        values.push('join the group', 'unirte al grupo');
    } else if (type === NotificationEnums.Types.NEW_GROUP_MEMBERS) {
        values.push('joined your group', 'se unieron a tu grupo');
    } else if (type === NotificationEnums.Types.NEW_AREAS_ACTIVATED) {
        values.push('new areas(s)', 'nueva(s) área(s)');
    } else if (type === NotificationEnums.Types.DISCOVERED_UNIQUE_MOMENT) {
        values.push('activate a moment', 'activar un momento');
    } else if (type === NotificationEnums.Types.DISCOVERED_UNIQUE_SPACE) {
        values.push('activate a space', 'activar un espacio');
    }

    return values;
};

const splitMessageByHighlights = (message: string, highlights: string[]): IMessageSegment[] => {
    if (!message) return [{ text: '', highlighted: false }];
    if (!highlights.length) return [{ text: message, highlighted: false }];

    // Find all matches with their positions (case-insensitive)
    const messageLower = message.toLowerCase();
    const matches: { start: number; end: number }[] = [];
    for (const highlight of highlights) {
        const idx = messageLower.indexOf(highlight.toLowerCase());
        if (idx !== -1) {
            matches.push({ start: idx, end: idx + highlight.length });
        }
    }

    if (!matches.length) return [{ text: message, highlighted: false }];

    // Sort by position
    matches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches
    const filtered = [matches[0]];
    for (let i = 1; i < matches.length; i++) {
        if (matches[i].start >= filtered[filtered.length - 1].end) {
            filtered.push(matches[i]);
        }
    }

    // Build segments
    const segments: IMessageSegment[] = [];
    let lastEnd = 0;
    for (const match of filtered) {
        if (match.start > lastEnd) {
            segments.push({ text: message.slice(lastEnd, match.start), highlighted: false });
        }
        segments.push({ text: message.slice(match.start, match.end), highlighted: true });
        lastEnd = match.end;
    }
    if (lastEnd < message.length) {
        segments.push({ text: message.slice(lastEnd), highlighted: false });
    }

    return segments;
};

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
    const rootStyle = isUnread ? themeNotification.styles.rootUnread : themeNotification.styles.rootRead;
    const messageContainerStyle = isUnread ? themeNotification.styles.messageContainerUnread : themeNotification.styles.messageContainerRead;
    const messageStyle = isUnread ? themeNotification.styles.unread : themeNotification.styles.read;
    const highlightStyle = isUnread ? themeNotification.styles.highlightUnread : themeNotification.styles.highlightRead;
    const iconStyle = isUnread ? themeNotification.styles.iconUnread : themeNotification.styles.iconRead;

    const highlightValues = getHighlightValues(notification);
    const messageSegments = splitMessageByHighlights(notification.message, highlightValues);

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
                    {messageSegments.map((segment, idx) => (
                        segment.highlighted
                            ? <Text key={idx} style={highlightStyle}>{segment.text}</Text>
                            : <React.Fragment key={idx}>{segment.text}</React.Fragment>
                    ))}
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
