import * as React from 'react';
import { ActivityIndicator, StyleSheet, View, Text, Pressable } from 'react-native';
import { Image } from './BaseImage';
import { getUserImageUri } from '../utilities/content';
import RichText from './RichText';
import handleMentionPress from '../utilities/handleMentionPress';

const TextMessage = ({
    connectionDetails,
    goToUser,
    userDetails,
    isLeft,
    isFirstOfMessage,
    message,
    theme,
    themeMessage,
    translate,
}) => {
    const isYou = () => (message.fromUserId
        ? message.fromUserId === userDetails?.id
        : !!message.fromUserName?.toLowerCase().includes('you'));
    const getName = () => {
        if (isYou()) {
            return 'You';
        }

        let fullName = `${connectionDetails.firstName} ${connectionDetails.lastName}`;
        if (fullName.includes('undefined')) {
            return connectionDetails.userName || translate('pages.userProfile.anonymous');
        }

        return fullName;
    };
    const onUserPress = () => goToUser(isYou() ? userDetails.id : connectionDetails.id);
    return (
        <>
            <View style={isLeft ? themeMessage.styles.messageContainerLeft : themeMessage.styles.messageContainerRight}>
                <RichText
                    style={isLeft ? themeMessage.styles.messageTextLeft : themeMessage.styles.messageTextRight}
                    text={message.text}
                    linkStyle={theme.styles.link}
                    onMentionPress={(username) => handleMentionPress(username, goToUser)}
                />
                <Text style={isLeft ? themeMessage.styles.messageDateLeft : themeMessage.styles.messageDateRight}>
                    {message.time}
                </Text>
            </View>
            {
                isFirstOfMessage &&
                <View style={[themeMessage.styles.sectionContainer, isYou() ? localStyles.justifyEnd : localStyles.justifyStart]}>
                    <Pressable
                        onPress={onUserPress}
                    >
                        <Image
                            source={{ uri: getUserImageUri(isYou() ? { details: userDetails } : { details: connectionDetails }, 50) }}
                            style={themeMessage.styles.userImage}
                            PlaceholderContent={<ActivityIndicator />}
                        />
                    </Pressable>
                    <Text style={theme.styles.sectionTitle} onPress={onUserPress}>
                        {getName()}
                    </Text>
                </View>
            }
        </>
    );
};

// Custom equality: parent passes inline arrow handlers per render in chat
// scrolls; bail out when message identity, styling flags, and theme refs are
// unchanged so older messages skip re-render as new ones arrive.
export default React.memo(TextMessage, (prev, next) => (
    prev.message?.id === next.message?.id
    && prev.message?.text === next.message?.text
    && prev.message?.time === next.message?.time
    && prev.message?.fromUserId === next.message?.fromUserId
    && prev.isLeft === next.isLeft
    && prev.isFirstOfMessage === next.isFirstOfMessage
    && prev.theme === next.theme
    && prev.themeMessage === next.themeMessage
));

const localStyles = StyleSheet.create({
    justifyEnd: {
        justifyContent: 'flex-end',
    },
    justifyStart: {
        justifyContent: 'flex-start',
    },
});
