import React from 'react';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { buttonMenuHeight } from '../styles/navigation/buttonMenu';

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
            containerStyle={{
                position: 'absolute',
                right: 20,
                bottom: buttonMenuHeight + 20,
                borderRadius: 100,
            }}
            buttonStyle={[themeButtons.styles.btn, { paddingRight: 20, paddingLeft: 10 }]}
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
