import * as React from 'react';
import { ActivityIndicator, View, Text, Pressable } from 'react-native';
import { Image } from 'react-native-elements';
import styles from '../styles';
import messageStyles from '../styles/user-content/messages';

export default ({
    connectionDetails,
    goToUser,
    userDetails,
    isLeft,
    isFirstOfMessage,
    message,
}) => {
    const isYou = () => message.fromUserName?.toLowerCase().includes('you');
    const getName = () => {
        if (isYou()) {
            return 'You';
        }

        return `${connectionDetails.firstName} ${connectionDetails.lastName}`;
    };
    return (
        <>
            <View style={isLeft ? messageStyles.messageContainerLeft : messageStyles.messageContainerRight}>
                <Text style={isLeft ? messageStyles.messageTextLeft : messageStyles.messageTextRight}>
                    {message.text}
                </Text>
                <Text style={isLeft ? messageStyles.messageDateLeft : messageStyles.messageDateRight}>
                    {message.time}
                </Text>
            </View>
            {
                isFirstOfMessage &&
                <View style={[messageStyles.sectionContainer, { justifyContent: isYou() ? 'flex-end' : 'flex-start' }]}>
                    <Pressable
                        onPress={() => goToUser(isYou() ? userDetails.id : connectionDetails.id)}
                    >
                        <Image
                            source={{ uri: `https://robohash.org/${isYou() ? userDetails.id : connectionDetails.id}?size=50x50` }}
                            style={messageStyles.userImage}
                            PlaceholderContent={<ActivityIndicator />}
                        />
                    </Pressable>
                    <Text style={styles.sectionTitle}>
                        {getName()}
                    </Text>
                </View>
            }
        </>
    );
};
