import * as React from 'react';
import { View, Text } from 'react-native';
import messageStyles from '../styles/messages';

export default ({
    isLeft,
    message,
}) => {
    return(
        <View style={isLeft ? messageStyles.messageContainerLeft : messageStyles.messageContainerRight}>
            <Text style={isLeft ? messageStyles.messageTextLeft : messageStyles.messageTextRight}>
                {message.text}
            </Text>
            <Text style={isLeft ? messageStyles.messageDateLeft : messageStyles.messageDateRight}>
                {message.time}
            </Text>
        </View>
    );
};
