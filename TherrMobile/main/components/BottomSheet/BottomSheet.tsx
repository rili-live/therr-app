import React from 'react';
import { Modal, Platform, Pressable } from 'react-native';
import { ITherrThemeColors } from '../../styles/themes';

interface IBottomSheet {
    children: React.ReactNode,
    isVisible: boolean;
    onRequestClose: any;
    themeModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    presentationStyle?: 'pageSheet' | 'fullScreen' | 'formSheet' | 'overFullScreen';
    shouldDimBackground?: boolean;
}

export default ({
    children,
    isVisible,
    onRequestClose,
    themeModal,
    presentationStyle,
    shouldDimBackground,
}: IBottomSheet) => {
    return (
        <Modal
            animationType="slide"
            visible={isVisible}
            onRequestClose={onRequestClose}
            transparent={true}
            presentationStyle={presentationStyle || 'overFullScreen'}
        >
            <Pressable
                onPress={onRequestClose}
                style={(shouldDimBackground && Platform.OS !== 'ios') ? themeModal.styles.bottomSheetOverlayDim : themeModal.styles.bottomSheetOverlay}>
                <Pressable style={themeModal.styles.bottomSheetContainer}>
                    {children}
                </Pressable>
            </Pressable>
        </Modal>
    );
};
