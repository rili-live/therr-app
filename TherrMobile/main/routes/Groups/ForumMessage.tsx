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
import { getUserImageUri } from '../../utilities/content';

const userColors: any = {}; // local state

const ForumMessage = ({
    item,
    theme,
    themeChat,
    themeMessage,
    fromUserDetails,
    userDetails,
    goToUser,
}) => {
    const isMe = item.fromUserName?.toLowerCase().includes('you') || item.fromUserId === userDetails.id;
    const senderTitle = !item.isAnnouncement ? item.fromUserName : '';
    const timeSplit = item.time.split(', ');
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
        // eslint-disable-next-line react-native/no-inline-styles
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
                    <Text style={themeChat.styles.messageTime}>{timeSplit[1]}</Text>
                </View>
                <Text style={themeChat.styles.messageText}>{item.text}</Text>
            </View>
        </View>
    );
};

export default ForumMessage;
