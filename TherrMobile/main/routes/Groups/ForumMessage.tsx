import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    Text,
    View,
} from 'react-native';
import { Image } from 'react-native-elements';
// import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import randomColor from 'randomcolor';
import Autolink from 'react-native-autolink';
import { getUserImageUri } from '../../utilities/content';
import { hoursDaysOrYearsSince } from '../../utilities/formatDate';

const userColors: any = {}; // local state

const ForumMessage = ({
    item,
    theme,
    themeChat,
    themeMessage,
    translate,
    fromUserDetails,
    userDetails,
    goToUser,
}) => {
    const isMe = item.fromUserName?.toLowerCase().includes('you') || item.fromUserId === userDetails.id;
    const senderTitle = !item.isAnnouncement ? item.fromUserName : '';
    const timeSplit = item.time.split(', ');
    const timeDisplay = item?.createdAtUnformatted ? hoursDaysOrYearsSince(new Date(item.createdAtUnformatted), translate as any) : timeSplit[1];
    const yourColor = theme.colors.accent3;

    if (!userColors[item.fromUserName]) {
        userColors[item.fromUserName] = isMe ? yourColor : randomColor({
            luminosity: 'dark',
        });
    }

    const messageColor = isMe
        ? (userColors[item.fromUserName] || yourColor)
        : (userColors[item.fromUserName] || theme.colors.accentBlue);

    const onUserPress = () => goToUser(isMe ? userDetails.id : fromUserDetails.id);
    const containerStyles: any = {
        borderColor: messageColor,
        paddingLeft: 10,
    };
    if (!isMe) {
        containerStyles.borderRightWidth = 5;
    } else {
        containerStyles.borderLeftWidth = 5;
    }

    return (

        <View style={[themeChat.styles.messageContainer, containerStyles]}>
            <Pressable
                onPress={onUserPress}
            >
                <Image
                    // source={{ uri: `${item.fromUserImgSrc}?size=50x50` }}
                    source={{ uri: getUserImageUri(isMe ? { details: userDetails } : { details: fromUserDetails }, 75) }}
                    style={themeMessage.styles.userImage}
                    PlaceholderContent={<ActivityIndicator />}
                />
            </Pressable>
            <View style={themeChat.styles.messageContentContainer}>
                <View style={themeChat.styles.messageHeader}>
                    {
                        !!senderTitle && <Text style={themeChat.styles.senderTitleText} onPress={onUserPress}>{senderTitle}</Text>
                    }
                    <Text style={themeChat.styles.messageTime}>{timeDisplay}</Text>
                </View>
                <Autolink
                    style={themeChat.styles.messageText}
                    text={item.text}
                    linkStyle={theme.styles.link}
                    phone="sms"
                    selectable
                />
            </View>
        </View>
    );
};

export default ForumMessage;
