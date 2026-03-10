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
    loading?: boolean;
}

const ModalButton = ({ color, disabled, loading, title, iconName, onPress, iconRight, themeButtons }: IModalButtonProps) => {
    const textColor = color === 'red' ? (themeButtons.styles.btnTitleRed?.color || 'red') : undefined;

    return (
        <Button
            mode="text"
            onPress={onPress}
            disabled={disabled}
            loading={loading}
            icon={iconName}
            textColor={textColor}
            contentStyle={iconRight ? { flexDirection: 'row-reverse' } : undefined}
            style={{ flex: 1, minWidth: 0 }}
            labelStyle={{ fontSize: 15 }}
        >
            {title}
        </Button>
    );
};

export default ModalButton;
