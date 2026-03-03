import React, { useState } from 'react';
import { Text, GestureResponderEvent } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import ModalButton from './ModalButton';

interface IDeleteAccountModal {
    isVisible: boolean;
    onRequestClose: any;
    translate: Function;
    themeButtons: {
        styles: any;
    };
    themeModal: {
        styles: any;
    };
}

export default ({
    isVisible,
    onRequestClose,
    themeButtons,
    themeModal,
    translate,
}: IDeleteAccountModal) => {
    const [tab, setTab] = useState(0);
    const onClose = (e?: GestureResponderEvent, action?: 'deactivate' | 'delete') => {
        e?.stopPropagation();
        setTab(0);
        onRequestClose(action);
    };

    const renderTab = () => {
        if (tab === 2) {
            return (
                <>
                    <Dialog.Title style={themeModal.styles.headerText}>
                        {translate('modals.deleteAccountModal.header3')}
                    </Dialog.Title>
                    <Dialog.Content>
                        <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.confirmDelete')}</Text>
                    </Dialog.Content>
                    <Dialog.Actions style={themeModal.styles.actionsContainer}>
                        <ModalButton
                            iconName="arrow-back"
                            title={translate('modals.deleteAccountModal.cancel')}
                            onPress={onClose}
                            iconRight={false}
                            themeButtons={themeButtons}
                        />
                        <ModalButton
                            iconName="check"
                            title={translate('modals.deleteAccountModal.confirm')}
                            onPress={(e) => onClose(e, 'delete')}
                            iconRight
                            themeButtons={themeButtons}
                        />
                    </Dialog.Actions>
                </>
            );
        }

        if (tab === 1) {
            return (
                <>
                    <Dialog.Title style={themeModal.styles.headerText}>
                        {translate('modals.deleteAccountModal.header2')}
                    </Dialog.Title>
                    <Dialog.Content>
                        <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.deactivateAccountMessage')}</Text>
                    </Dialog.Content>
                    <Dialog.Actions style={themeModal.styles.actionsContainer}>
                        <ModalButton
                            iconName="remove"
                            title={translate('modals.deleteAccountModal.deactivate')}
                            onPress={(e) => onClose(e, 'deactivate')}
                            iconRight={false}
                            themeButtons={themeButtons}
                        />
                        <ModalButton
                            color="red"
                            iconName="delete-forever"
                            title={translate('modals.deleteAccountModal.delete')}
                            onPress={() => setTab(2)}
                            iconRight
                            themeButtons={themeButtons}
                        />
                    </Dialog.Actions>
                </>
            );
        }

        return (
            <>
                <Dialog.Title style={themeModal.styles.headerText}>
                    {translate('modals.deleteAccountModal.header1')}
                </Dialog.Title>
                <Dialog.Content>
                    <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.deleteAccountMessage')}</Text>
                </Dialog.Content>
                <Dialog.Actions style={themeModal.styles.actionsContainer}>
                    <ModalButton
                        iconName="close"
                        title={translate('modals.deleteAccountModal.cancel')}
                        onPress={onClose}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="arrow-forward"
                        title={translate('modals.deleteAccountModal.continue')}
                        onPress={() => setTab(1)}
                        iconRight
                        themeButtons={themeButtons}
                    />
                </Dialog.Actions>
            </>
        );
    };

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onClose}
                style={themeModal.styles.container}
            >
                {renderTab()}
            </Dialog>
        </Portal>
    );
};
