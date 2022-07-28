import React, { useState } from 'react';
import { Text, Modal, Pressable, View, GestureResponderEvent } from 'react-native';
import AnimatedLottieView from 'lottie-react-native';

import claimASpace from '../../assets/claim-a-space.json';
import shareAMoment from '../../assets/share-a-moment.json';
import discover from '../../assets/discover.json';
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
    const onClose = (e?: GestureResponderEvent) => {
        e?.stopPropagation();
        setTab(0);
        onRequestClose();
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
                        <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.exploreTheWorld')}</Text>
                        <View style={themeModal.styles.actionsContainer}>
                            <ModalButton
                                iconName="arrow-forward"
                                title={translate('modals.deleteAccountModal.next')}
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
                        <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.createAMoment')}</Text>
                        <View style={themeModal.styles.actionsContainer}>
                            <ModalButton
                                iconName="arrow-back"
                                title={translate('modals.deleteAccountModal.back')}
                                onPress={() => setTab(0)}
                                iconRight={false}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="arrow-forward"
                                title={translate('modals.deleteAccountModal.next')}
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
                        <Text style={themeModal.styles.text}>{translate('modals.deleteAccountModal.claimYourSpaces')}</Text>
                        <View style={themeModal.styles.actionsContainer}>
                            <ModalButton
                                iconName="arrow-back"
                                title={translate('modals.deleteAccountModal.back')}
                                onPress={() => setTab(1)}
                                iconRight={false}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="check"
                                title={translate('modals.deleteAccountModal.done')}
                                onPress={onClose}
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
