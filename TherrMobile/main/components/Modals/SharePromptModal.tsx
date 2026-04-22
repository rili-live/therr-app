import React from 'react';
import { Share, Text } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import { ITherrThemeColors } from '../../styles/themes';
import ModalButton from './ModalButton';

interface ISharePromptModal {
    isVisible: boolean;
    headerText: string;
    message: string;
    shareMessage: string;
    shareUrl: string;
    shareTitle: string;
    onDismiss: () => void;
    translate: Function;
    themeModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const SharePromptModal: React.FC<ISharePromptModal> = ({
    isVisible,
    headerText,
    message,
    shareMessage,
    shareUrl,
    shareTitle,
    onDismiss,
    translate,
    themeModal,
    themeButtons,
}) => {
    const onShare = () => {
        Share.share({
            message: shareMessage,
            url: shareUrl,
            title: shareTitle,
        }).then(() => {
            onDismiss();
        }).catch((err) => {
            console.error(err);
        });
    };

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onDismiss}
                style={themeModal.styles.container}
            >
                <Dialog.Title style={themeModal.styles.headerText}>{headerText}</Dialog.Title>
                <Dialog.Content>
                    <Text style={themeModal.styles.bodyText}>{message}</Text>
                </Dialog.Content>
                <Dialog.Actions style={themeModal.styles.buttonsContainer}>
                    <ModalButton
                        iconName="close"
                        title={translate('modals.sharePrompt.notNow')}
                        onPress={onDismiss}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="share"
                        title={translate('modals.sharePrompt.share')}
                        onPress={onShare}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default SharePromptModal;
