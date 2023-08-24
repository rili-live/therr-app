import React from 'react';
import { Text, Modal, Pressable, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import AnimatedLottieView from 'lottie-react-native';
import spacingStyles from '../../styles/layouts/spacing';

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

const ModalButton = ({ title, iconName, onPress, iconRight, themeButtons }) => {
    const iconStyle = iconRight ? { paddingLeft: 7 } : { paddingRight: 7 };
    return (
        <Button
            containerStyle={spacingStyles.flexOne}
            buttonStyle={[themeButtons.styles.btnClear, spacingStyles.padMd]}
            titleStyle={themeButtons.styles.btnTitleBlack}
            icon={
                <MaterialIcon
                    name={iconName}
                    size={20}
                    style={[themeButtons.styles.btnIconBlack, iconStyle]}
                />
            }
            iconRight={iconRight}
            raised={true}
            type="clear"
            onPress={onPress}
            title={title}
        />
    );
};

export default ({
    isVisible,
    onRequestClose,
    themeButtons,
    themeModal,
    translate,
}: IInfoModal) => {
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
                    <AnimatedLottieView
                        source={shareAMoment}
                        // resizeMode="cover"
                        resizeMode="contain"
                        speed={1}
                        autoPlay={true}
                        loop
                        style={themeModal.styles.graphic}
                    />
                    <Text style={themeModal.styles.header}>{translate('modals.infoModalPoints.header')}</Text>
                    <Text style={themeModal.styles.text}>{translate('modals.infoModalPoints.description')}</Text>
                    <View style={themeModal.styles.actionsContainer}>
                        <ModalButton
                            iconName="check"
                            title={translate('modals.infoModalPoints.done')}
                            onPress={onRequestClose}
                            iconRight
                            themeButtons={themeButtons}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
