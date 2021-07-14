import React from 'react';
import { View, Text } from 'react-native';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { alertMsg } from '../styles/alerts';

export default ({
    containerStyles,
    isVisible,
    message,
    type,
}) => {
    if (!isVisible) {
        return null;
    }

    // Styles
    let containerStyle = type === 'error' ? alertMsg.containerError : alertMsg.containerSuccess;
    let messageStyle = type === 'error' ? alertMsg.error : alertMsg.success;
    let iconStyle = type === 'error' ? alertMsg.iconError : alertMsg.iconSuccess;

    let iconName = type === 'error' ? 'exclamation-circle' : 'check-circle';

    return (
        <View style={{
            ...containerStyle,
            ...containerStyles,
        }}>
            <FontAwesomeIcon
                name={iconName}
                size={23}
                style={iconStyle}
            />
            <Text style={messageStyle}>
                {message}
            </Text>
        </View>
    );
};
