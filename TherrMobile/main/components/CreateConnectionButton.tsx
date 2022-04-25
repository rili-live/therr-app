import React from 'react';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

export default ({
    navigation,
    themeButtons,
    translate,
}) => {
    const goToAddConnection = () => {
        navigation.navigate('CreateConnection');
    };

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
            title={translate('menus.connections.buttons.add')}
            onPress={goToAddConnection}
        />
    );
};
