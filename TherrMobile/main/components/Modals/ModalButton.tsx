import React from 'react';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

interface IModalButtonProps {
    color?: string;
    title: any;
    iconName: any;
    onPress: any;
    iconRight: any;
    themeButtons: any;
}

const ModalButton = ({ color, title, iconName, onPress, iconRight, themeButtons }: IModalButtonProps) => {
    const iconStyle = iconRight ? { paddingLeft: 7 } : { paddingRight: 7 };
    return (
        <Button
            containerStyle={{ flex: 1 }}
            buttonStyle={[themeButtons.styles.btnClear, { padding: 10 }]}
            titleStyle={color ? themeButtons.styles.btnTitleRed : themeButtons.styles.btnTitleBlack}
            icon={
                <MaterialIcon
                    name={iconName}
                    size={20}
                    style={[color ? themeButtons.styles.btnTitleRed : themeButtons.styles.btnIconBlack, iconStyle]}
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
