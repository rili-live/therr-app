import React from 'react';
import { Text, Modal, Pressable, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import styles from '../../styles/modal/confirmModal';
import buttonStyles from '../../styles/buttons';
import { ScrollView } from 'react-native-gesture-handler';

interface IConfirmModal {
    headerText?: string;
    isVisible: boolean;
    onCancel: any;
    onConfirm: any;
    text: string;
    textConfirm?: string;
    textCancel?: string;
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
    headerText,
    isVisible,
    onCancel,
    onConfirm,
    text,
    textConfirm,
    textCancel,
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
                    {
                        headerText ?
                            <>
                                <View style={styles.header}>
                                    <Text style={styles.headerText}>{headerText}</Text>
                                </View>
                                <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                                    <View onStartShouldSetResponder={() => true}>
                                        <Text style={styles.bodyText}>{text}</Text>
                                    </View>
                                </ScrollView>
                            </> :
                            <Text style={styles.bodyTextBold}>{text}</Text>
                    }
                    <View style={styles.buttonsContainer}>
                        <ModalButton
                            iconName="close"
                            title={textCancel || translate('modals.confirmModal.cancel')}
                            onPress={() => onCancel()}
                            hasBorderRight={true}
                        />
                        <ModalButton
                            iconName="check"
                            title={textConfirm || translate('modals.confirmModal.confirm')}
                            onPress={() => onConfirm()}
                            hasBorderRight={false}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
