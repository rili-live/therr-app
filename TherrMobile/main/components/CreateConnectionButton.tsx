import React from 'react';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import buttonStyles from '../styles/buttons';
import { buttonMenuHeight } from '../styles/navigation/buttonMenu';

export default ({
    navigation,
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
            buttonStyle={buttonStyles.btn}
            icon={
                <MaterialIcon
                    name="add"
                    size={40}
                    style={buttonStyles.btnIcon}
                />
            }
            raised={true}
            onPress={goToAddConnection}
        />
    );
};
