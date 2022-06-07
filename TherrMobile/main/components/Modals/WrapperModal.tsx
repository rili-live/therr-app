import React from 'react';
import { Modal, Pressable } from 'react-native';

interface IWrapperModal {
    children: React.ReactNode;
    isVisible: boolean;
    onRequestClose: any;
    themeModal: {
        styles: any;
    };
}

export default ({
    children,
    isVisible,
    onRequestClose,
    themeModal,
}: IWrapperModal) => {
    return (
        <Modal
            animationType="fade"
            visible={isVisible}
            onRequestClose={onRequestClose}
            transparent={true}
            style={{
                zIndex: 1000,
            }}
        >
            <Pressable
                onPress={onRequestClose}
                style={themeModal.styles.overlay}>
                <Pressable style={themeModal.styles.container}>
                    {children}
                </Pressable>
            </Pressable>
        </Modal>
    );
};
