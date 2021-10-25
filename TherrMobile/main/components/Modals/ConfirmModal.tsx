import React from 'react';
import { Text, Modal, Pressable, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import styles from '../../styles/modal/confirmModal';
import buttonStyles from '../../styles/buttons';

interface IConfirmModal {
    isVisible: boolean;
    onCancel: any;
    onConfirm: any;
    text: string;
    translate: Function;
    width?: string;
}

const ModalButton = ({ title, hasBorderRight, iconName, onPress }) => {
    const extraStyles = hasBorderRight ? { borderRightWidth: 1 } : {};

    return (
        <Button
            containerStyle={[styles.buttonContainer, extraStyles]}
            buttonStyle={[buttonStyles.btnClear, { padding: 10 }]}
            titleStyle={buttonStyles.btnTitleBlack}
            icon={
                <MaterialIcon
                    name={iconName}
                    size={20}
                    style={[buttonStyles.btnIconBlack, { paddingRight: 7 }]}
                />
            }
            raised={true}
            type="clear"
            onPress={onPress}
            title={title}
        />
    );
};

export default ({
    isVisible,
    onCancel,
    onConfirm,
    text,
    translate,
    width,
}: IConfirmModal) => {
    const extraStyles = width ? { width: width } : {};

    return (
        <Modal
            animationType="slide"
            visible={isVisible}
            onRequestClose={onCancel}
            transparent={true}
        >
            <Pressable
                onPress={onCancel}
                style={styles.overlay}>
                <Pressable style={[styles.container, extraStyles]}>
                    <Text style={styles.header}>{text}</Text>
                    <View style={styles.buttonsContainer}>
                        <ModalButton
                            iconName="close"
                            title={translate('modals.confirmModal.cancel')}
                            onPress={() => onCancel()}
                            hasBorderRight={true}
                        />
                        <ModalButton
                            iconName="check"
                            title={translate('modals.confirmModal.confirm')}
                            onPress={() => onConfirm()}
                            hasBorderRight={false}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
