import React from 'react';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import spacingStyles from '../../styles/layouts/spacing';

interface IModalButtonProps {
    color?: string;
    title: any;
    iconName: any;
    onPress: any;
    iconRight: any;
    themeButtons: any;
    disabled?: boolean;
}

const ModalButton = ({ color, disabled, title, iconName, onPress, iconRight, themeButtons }: IModalButtonProps) => {
    const iconStyle = iconRight ? { paddingLeft: 7 } : { paddingRight: 7 };
    return (
        <Button
            containerStyle={spacingStyles.flexOne}
            buttonStyle={[themeButtons.styles.btnClear, spacingStyles.padMd]}
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
            disabled={disabled}
        />
    );
};

export default ModalButton;
