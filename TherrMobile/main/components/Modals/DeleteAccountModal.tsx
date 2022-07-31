import React, { useState } from 'react';
import { Text, Modal, Pressable, View, GestureResponderEvent } from 'react-native';
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

    return (
        <Modal
            animationType="fade"
            visible={isVisible}
            onRequestClose={onClose}
            transparent={true}
            // style={{
            //     zIndex: 1000,
            // }}
        >
            <Pressable
                onPress={onClose}
                style={themeModal.styles.overlay}>
                {
                    (tab < 1) &&
                    <Pressable style={themeModal.styles.container}>
                        <View style={themeModal.styles.header}>
                            <Text style={themeModal.styles.headerText}>{translate('modals.deleteAccountModal.header1')}</Text>
                        </View>
                        <View style={themeModal.styles.body}>
                            <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.deleteAccountMessage')}</Text>
                        </View>
                        <View style={themeModal.styles.actionsContainer}>
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
                        </View>
                    </Pressable>
                }
                {
                    (tab === 1) &&
                    <Pressable style={themeModal.styles.container}>
                        <View style={themeModal.styles.header}>
                            <Text style={themeModal.styles.headerText}>{translate('modals.deleteAccountModal.header2')}</Text>
                        </View>
                        <View style={themeModal.styles.body}>
                            <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.deactivateAccountMessage')}</Text>
                        </View>
                        <View style={themeModal.styles.actionsContainer}>
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
                        </View>
                    </Pressable>
                }
                {
                    (tab === 2) &&
                    <Pressable style={themeModal.styles.container}>
                        <View style={themeModal.styles.header}>
                            <Text style={themeModal.styles.headerText}>{translate('modals.deleteAccountModal.header3')}</Text>
                        </View>
                        <View style={themeModal.styles.body}>
                            <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.confirmDelete')}</Text>
                        </View>
                        <View style={themeModal.styles.actionsContainer}>
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
                        </View>
                    </Pressable>
                }
            </Pressable>
        </Modal>
    );
};
