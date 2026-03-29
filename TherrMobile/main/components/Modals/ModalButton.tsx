import React from 'react';
import { StyleSheet } from 'react-native';
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
            contentStyle={iconRight ? localStyles.rowReverse : undefined}
            style={localStyles.buttonFlex}
            labelStyle={localStyles.labelText}
        >
            {title}
        </Button>
    );
};

const localStyles = StyleSheet.create({
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    buttonFlex: {
        flex: 1,
        minWidth: 0,
    },
    labelText: {
        fontSize: 15,
    },
});

export default ModalButton;
