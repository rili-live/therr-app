import React from 'react';
import { Button } from 'react-native-paper';

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
    const textColor = color === 'red' ? (themeButtons.styles.btnTitleRed?.color || 'red') : undefined;

    return (
        <Button
            mode="text"
            onPress={onPress}
            disabled={disabled}
            icon={iconName}
            textColor={textColor}
            contentStyle={iconRight ? { flexDirection: 'row-reverse' } : undefined}
            style={{ flex: 1 }}
        >
            {title}
        </Button>
    );
};

export default ModalButton;
