import React from 'react';
import { Text, Modal, Pressable, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import buttonStyles from '../../styles/buttons';
import { ScrollView } from 'react-native-gesture-handler';
import { ITherrThemeColors } from 'main/styles/themes';

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
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    }
}

const ModalButton = ({ title, hasBorderRight, iconName, onPress, theme }) => {
    const extraStyles = hasBorderRight ? { borderRightWidth: 1 } : {};

    return (
        <Button
            containerStyle={[theme.styles.buttonContainer, extraStyles]}
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
    theme,
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
                style={theme.styles.overlay}>
                <Pressable style={[theme.styles.container, extraStyles]}>
                    {
                        headerText ?
                            <>
                                <View style={theme.styles.header}>
                                    <Text style={theme.styles.headerText}>{headerText}</Text>
                                </View>
                                <ScrollView style={theme.styles.body} contentContainerStyle={theme.styles.bodyContent}>
                                    <View onStartShouldSetResponder={() => true}>
                                        <Text style={theme.styles.bodyText}>{text}</Text>
                                    </View>
                                </ScrollView>
                            </> :
                            <Text style={theme.styles.bodyTextBold}>{text}</Text>
                    }
                    <View style={theme.styles.buttonsContainer}>
                        <ModalButton
                            iconName="close"
                            title={textCancel || translate('modals.confirmModal.cancel')}
                            onPress={() => onCancel()}
                            hasBorderRight={true}
                            theme={theme}
                        />
                        <ModalButton
                            iconName="check"
                            title={textConfirm || translate('modals.confirmModal.confirm')}
                            onPress={() => onConfirm()}
                            hasBorderRight={false}
                            theme={theme}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
