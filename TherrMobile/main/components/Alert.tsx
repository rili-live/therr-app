import React from 'react';
import { View, Text } from 'react-native';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';

export default ({
    containerStyles,
    isVisible,
    message,
    type,
    themeAlerts,
}) => {
    if (!isVisible) {
        return null;
    }

    // Styles
    let containerStyle = type === 'error' ? themeAlerts.styles.containerError : themeAlerts.styles.containerSuccess;
    let messageStyle = type === 'error' ? themeAlerts.styles.error : themeAlerts.styles.success;
    let iconStyle = type === 'error' ? themeAlerts.styles.iconError : themeAlerts.styles.iconSuccess;

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
