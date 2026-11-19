import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    Text,
    View,
} from 'react-native';
import { Image } from '../../components/BaseImage';
import 'react-native-gesture-handler';
import { getUserImageUri } from '../../utilities/content';
import RichText from '../../components/RichText';
import handleMentionPress from '../../utilities/handleMentionPress';
import { hoursDaysOrYearsSince } from '../../utilities/formatDate';
import { getSenderColor, isOwnForumMessage } from './groupUtils';

/**
 * One row of a group chat.
 *
 * - Own messages: right-aligned bubble in the brand color, no avatar or name.
 * - Others' messages: avatar, then a neutral bubble headed by the sender's name in a color derived
 *   from their user id, so a person keeps the same color across launches and devices.
 * - Announcements ("… joined the room"): a centered caption, not a bubble.
 */
const ForumMessage = ({
    item,
    theme,
    themeChat,
    translate,
    fromUserDetails,
    userDetails,
    goToUser,
}: any) => {
    const isMe = isOwnForumMessage(item, userDetails?.id);
    const timeSplit = (item.time || '').split(', ');
    const timeDisplay = item?.createdAtUnformatted
        ? hoursDaysOrYearsSince(new Date(item.createdAtUnformatted), translate as any)
        : timeSplit[1];

    if (item.isAnnouncement) {
        return (
            <View style={themeChat.styles.announcementRow}>
                <Text style={themeChat.styles.announcementText}>{item.text}</Text>
            </View>
        );
    }

    const onUserPress = () => goToUser(isMe ? userDetails.id : fromUserDetails.id);

    if (isMe) {
        return (
            <View style={[themeChat.styles.messageRow, themeChat.styles.messageRowOwn]}>
                <View style={[themeChat.styles.bubble, themeChat.styles.bubbleOwn]}>
                    <RichText
                        style={[themeChat.styles.messageText, themeChat.styles.messageTextOwn]}
                        text={item.text}
                        linkStyle={[theme.styles.link, themeChat.styles.messageTextOwn]}
                        onMentionPress={(username) => handleMentionPress(username, goToUser)}
                        selectable
                    />
                    {!!timeDisplay && <Text style={[themeChat.styles.messageTime, themeChat.styles.messageTimeOwn]}>{timeDisplay}</Text>}
                </View>
            </View>
        );
    }

    const senderColor = getSenderColor(fromUserDetails?.id || item.fromUserName, [
        theme.colors.brand,
        theme.colors.brandingOrange,
        theme.colors.accentPurple,
        theme.colors.accentLime,
        theme.colors.accentRed,
    ]);

    return (
        <View style={themeChat.styles.messageRow}>
            <Pressable onPress={onUserPress} accessibilityRole="button" accessibilityLabel={item.fromUserName}>
                <Image
                    source={{ uri: getUserImageUri({ details: fromUserDetails }, 75) }}
                    style={themeChat.styles.senderAvatar}
                    PlaceholderContent={<ActivityIndicator />}
                />
            </Pressable>
            <View style={[themeChat.styles.bubble, themeChat.styles.bubbleOther]}>
                {
                    !!item.fromUserName &&
                    <Text style={[themeChat.styles.senderName, { color: senderColor }]} onPress={onUserPress} numberOfLines={1}>
                        {item.fromUserName}
                    </Text>
                }
                <RichText
                    style={themeChat.styles.messageText}
                    text={item.text}
                    linkStyle={theme.styles.link}
                    onMentionPress={(username) => handleMentionPress(username, goToUser)}
                    selectable
                />
                {!!timeDisplay && <Text style={themeChat.styles.messageTime}>{timeDisplay}</Text>}
            </View>
        </View>
    );
};

export default ForumMessage;
