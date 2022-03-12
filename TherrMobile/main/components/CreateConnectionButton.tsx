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
            buttonStyle={[themeButtons.styles.btnLargeWithText, { paddingRight: 20, paddingLeft: 10 }]}
            titleStyle={themeButtons.styles.btnMediumTitleRight}
            icon={
                <MaterialIcon
                    name="add"
                    size={40}
                    style={themeButtons.styles.btnIcon}
                />
            }
            raised={true}
            title={translate('menus.connections.buttons.add')}
            onPress={goToAddConnection}
        />
    );
};
