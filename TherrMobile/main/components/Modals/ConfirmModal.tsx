import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Dialog, Divider, Portal } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import { ITherrThemeColors } from '../../styles/themes';
import ModalButton from './ModalButton';

interface IConfirmModal {
    headerText?: string;
    isConfirming?: boolean;
    isVisible: boolean;
    onCancel: any;
    onConfirm: any;
    renderImage?: () => React.ReactNode,
    text: string;
    text2?: string;
    textConfirm?: string;
    textCancel?: string;
    translate: Function;
    width?: string;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

export default ({
    headerText,
    isConfirming,
    isVisible,
    onCancel,
    onConfirm,
    renderImage,
    text,
    text2,
    textConfirm,
    textCancel,
    themeModal,
    themeButtons,
    translate,
    width,
}: IConfirmModal) => {
    const extraStyles = width ? { width: width } : {};

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onCancel}
                style={[themeModal.styles.container, extraStyles]}
            >
                {
                    renderImage && renderImage()
                }
                {
                    headerText ?
                        <>
                            <Dialog.Title style={themeModal.styles.headerText}>{headerText}</Dialog.Title>
                            <Divider />
                            <Dialog.ScrollArea style={[themeModal.styles.body, localStyles.transparentBorder]}>
                                <ScrollView>
                                    <Text style={themeModal.styles.bodyText}>{text}</Text>
                                    {
                                        text2 && <Text style={themeModal.styles.bodyText}>{text2}</Text>
                                    }
                                </ScrollView>
                            </Dialog.ScrollArea>
                        </> :
                        <Dialog.ScrollArea style={localStyles.transparentBorder}>
                            <ScrollView>
                                <Text style={themeModal.styles.bodyTextBold}>{text}</Text>
                            </ScrollView>
                        </Dialog.ScrollArea>
                }
                <Divider />
                <Dialog.Actions style={themeModal.styles.buttonsContainer}>
                    <ModalButton
                        iconName="close"
                        title={textCancel || translate('modals.confirmModal.cancel')}
                        onPress={onCancel}
                        disabled={isConfirming}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="check"
                        title={textConfirm || translate('modals.confirmModal.confirm')}
                        onPress={onConfirm}
                        loading={isConfirming}
                        disabled={isConfirming}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const localStyles = StyleSheet.create({
    transparentBorder: {
        borderColor: 'transparent',
    },
});
