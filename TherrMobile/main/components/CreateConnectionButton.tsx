import React from 'react';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

export default ({
    themeButtons,
    onPress,
    title,
}) => {
    return (
        <Button
            containerStyle={themeButtons.styles.buttonFloatBottomRightContainer}
            buttonStyle={[themeButtons.styles.btnLargeWithText]}
            titleStyle={themeButtons.styles.btnLargeTitle}
            icon={
                <MaterialIcon
                    name="add"
                    size={22}
                    style={themeButtons.styles.btnIcon}
                />
            }
            raised={true}
            title={title}
            onPress={onPress}
        />
    );
};
