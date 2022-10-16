import React from 'react';
import { Modal, Pressable } from 'react-native';
import { ITherrThemeColors } from '../../styles/themes';

interface IBottomSheet {
    children: React.ReactNode,
    isVisible: boolean;
    onRequestClose: any;
    themeModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

export default ({
    children,
    isVisible,
    onRequestClose,
    themeModal,
}: IBottomSheet) => {
    return (
        <Modal
            animationType="slide"
            visible={isVisible}
            onRequestClose={onRequestClose}
            transparent={true}
        >
            <Pressable
                onPress={onRequestClose}
                style={themeModal.styles.bottomSheetOverlay}>
                <Pressable style={themeModal.styles.bottomSheetContainer}>
                    {children}
                </Pressable>
            </Pressable>
        </Modal>
    );
};
