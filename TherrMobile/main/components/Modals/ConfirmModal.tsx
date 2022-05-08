import React from 'react';
import { Text, Modal, Pressable, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ScrollView } from 'react-native-gesture-handler';
import { ITherrThemeColors } from '../../styles/themes';

interface IConfirmModal {
    headerText?: string;
    isVisible: boolean;
    onCancel: any;
    onConfirm: any;
    renderImage?: () => React.ReactNode,
    text: string;
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

const ModalButton = ({ title, hasBorderRight, iconName, onPress, themeButtons, themeModal }) => {
    const extraStyles = hasBorderRight ? { borderRightWidth: 1 } : {};

    return (
        <Button
            containerStyle={[themeModal.styles.buttonContainer, extraStyles]}
            buttonStyle={[themeButtons.styles.btnClear, { padding: 10 }]}
            titleStyle={themeButtons.styles.btnTitleBlack}
            icon={
                <MaterialIcon
                    name={iconName}
                    size={20}
                    style={[themeButtons.styles.btnIconBlack, { paddingRight: 7 }]}
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
    renderImage,
    text,
    textConfirm,
    textCancel,
    themeModal,
    themeButtons,
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
                style={themeModal.styles.overlay}>
                <Pressable style={[themeModal.styles.container, extraStyles]}>
                    {
                        renderImage && renderImage()
                    }
                    {
                        headerText ?
                            <>
                                <View style={themeModal.styles.header}>
                                    <Text style={themeModal.styles.headerText}>{headerText}</Text>
                                </View>
                                <ScrollView style={themeModal.styles.body} contentContainerStyle={themeModal.styles.bodyContent}>
                                    <View onStartShouldSetResponder={() => true}>
                                        <Text style={themeModal.styles.bodyText}>{text}</Text>
                                    </View>
                                </ScrollView>
                            </> :
                            <Text style={themeModal.styles.bodyTextBold}>{text}</Text>
                    }
                    <View style={themeModal.styles.buttonsContainer}>
                        <ModalButton
                            iconName="close"
                            title={textCancel || translate('modals.confirmModal.cancel')}
                            onPress={() => onCancel()}
                            hasBorderRight={true}
                            themeModal={themeModal}
                            themeButtons={themeButtons}
                        />
                        <ModalButton
                            iconName="check"
                            title={textConfirm || translate('modals.confirmModal.confirm')}
                            onPress={() => onConfirm()}
                            hasBorderRight={false}
                            themeModal={themeModal}
                            themeButtons={themeButtons}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
