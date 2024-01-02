import * as React from 'react';
import { ActivityIndicator, View, Text, Pressable } from 'react-native';
import { Image } from 'react-native-elements';
import { getUserImageUri } from '../utilities/content';

export default ({
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
    const isYou = () => message.fromUserName?.toLowerCase().includes('you');
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
                <Text style={isLeft ? themeMessage.styles.messageTextLeft : themeMessage.styles.messageTextRight}>
                    {message.text}
                </Text>
                <Text style={isLeft ? themeMessage.styles.messageDateLeft : themeMessage.styles.messageDateRight}>
                    {message.time}
                </Text>
            </View>
            {
                isFirstOfMessage &&
                <View style={[themeMessage.styles.sectionContainer, { justifyContent: isYou() ? 'flex-end' : 'flex-start' }]}>
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
