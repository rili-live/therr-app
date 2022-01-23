import React from 'react';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { buttonMenuHeight } from '../styles/navigation/buttonMenu';

export default ({
    navigation,
    themeButtons,
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
            }}
            buttonStyle={themeButtons.styles.btn}
            icon={
                <MaterialIcon
                    name="add"
                    size={40}
                    style={themeButtons.styles.btnIcon}
                />
            }
            raised={true}
            onPress={goToAddConnection}
        />
    );
};
