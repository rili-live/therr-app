import React from 'react';
import { Dialog, Portal } from 'react-native-paper';

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
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onRequestClose}
                style={themeModal.styles.container}
            >
                {children}
            </Dialog>
        </Portal>
    );
};
