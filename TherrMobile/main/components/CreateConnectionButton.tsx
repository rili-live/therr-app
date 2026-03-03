import React from 'react';
import { FAB } from 'react-native-paper';

export default ({
    themeButtons,
    onPress,
    title,
}) => {
    return (
        <FAB
            icon="plus"
            label={title}
            onPress={onPress}
            style={themeButtons.styles.buttonFloatBottomRightContainer}
        />
    );
};
