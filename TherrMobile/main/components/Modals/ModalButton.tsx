import React from 'react';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

const ModalButton = ({ title, iconName, onPress, iconRight, themeButtons }) => {
    const iconStyle = iconRight ? { paddingLeft: 7 } : { paddingRight: 7 };
    return (
        <Button
            containerStyle={{ flex: 1 }}
            buttonStyle={[themeButtons.styles.btnClear, { padding: 10 }]}
            titleStyle={themeButtons.styles.btnTitleBlack}
            icon={
                <MaterialIcon
                    name={iconName}
                    size={20}
                    style={[themeButtons.styles.btnIconBlack, iconStyle]}
                />
            }
            iconRight={iconRight}
            raised={true}
            type="clear"
            onPress={onPress}
            title={title}
        />
    );
};

export default ModalButton;
