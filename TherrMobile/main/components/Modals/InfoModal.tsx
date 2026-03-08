import React from 'react';
import { Text } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import AnimatedLottieView from 'lottie-react-native';
import ModalButton from './ModalButton';

// import shareAMoment from '../../assets/share-a-moment.json';
import shareAMoment from '../../assets/coin-wallet.json';

interface IInfoModal {
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
}: IInfoModal) => {
    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onRequestClose}
                style={themeModal.styles.container}
            >
                <Dialog.Content>
                    <AnimatedLottieView
                        source={shareAMoment}
                        resizeMode="contain"
                        speed={1}
                        autoPlay={true}
                        loop
                        style={themeModal.styles.graphic}
                    />
                    <Text style={themeModal.styles.header}>{translate('modals.infoModalPoints.header')}</Text>
                    <Text style={themeModal.styles.text}>{translate('modals.infoModalPoints.description')}</Text>
                </Dialog.Content>
                <Dialog.Actions style={themeModal.styles.actionsContainer}>
                    <ModalButton
                        iconName="check"
                        title={translate('modals.infoModalPoints.done')}
                        onPress={onRequestClose}
                        iconRight
                        themeButtons={themeButtons}
                    />
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};
