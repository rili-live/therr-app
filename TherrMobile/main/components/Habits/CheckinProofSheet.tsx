import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Dialog, Divider, Portal } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import { ITherrThemeColors } from '../../styles/themes';
import ModalButton from '../Modals/ModalButton';

interface ICheckinProofSheetProps {
    isVisible: boolean;
    isSubmitting?: boolean;
    habitName?: string;
    onCancel: () => void;
    onConfirm: (args: { notes?: string }) => void;
    translate: (key: string, params?: any) => string;
    themeConfirmModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const MAX_NOTE_LENGTH = 500;

const CheckinProofSheet: React.FC<ICheckinProofSheetProps> = ({
    isVisible,
    isSubmitting = false,
    habitName,
    onCancel,
    onConfirm,
    translate,
    themeConfirmModal,
    themeButtons,
}) => {
    const [notes, setNotes] = useState('');

    const handleCancel = () => {
        setNotes('');
        onCancel();
    };

    const handleConfirm = () => {
        const trimmed = notes.trim();
        onConfirm({ notes: trimmed.length ? trimmed : undefined });
        setNotes('');
    };

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={handleCancel}
                style={themeConfirmModal.styles.container}
            >
                <Dialog.Title style={themeConfirmModal.styles.headerText}>
                    {translate('pages.habits.checkinProof.title')}
                </Dialog.Title>
                <Divider />
                <Dialog.ScrollArea style={[themeConfirmModal.styles.body, localStyles.transparentBorder]}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {habitName ? (
                            <Text style={themeConfirmModal.styles.bodyTextBold}>{habitName}</Text>
                        ) : null}
                        <Text style={[themeConfirmModal.styles.bodyText, localStyles.prompt]}>
                            {translate('pages.habits.checkinProof.notePrompt')}
                        </Text>
                        <View style={localStyles.inputContainer}>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                placeholder={translate('pages.habits.checkinProof.notePlaceholder')}
                                placeholderTextColor={themeConfirmModal.colors.textGray}
                                multiline
                                maxLength={MAX_NOTE_LENGTH}
                                style={[
                                    localStyles.input,
                                    {
                                        color: themeConfirmModal.colors.textWhite,
                                        borderColor: themeConfirmModal.colors.textGray,
                                    },
                                ]}
                                editable={!isSubmitting}
                            />
                            <Text style={[localStyles.counter, { color: themeConfirmModal.colors.textGray }]}>
                                {notes.length}/{MAX_NOTE_LENGTH}
                            </Text>
                        </View>
                    </ScrollView>
                </Dialog.ScrollArea>
                <Divider />
                <Dialog.Actions style={themeConfirmModal.styles.buttonsContainer}>
                    <ModalButton
                        iconName="close"
                        title={translate('pages.habits.checkinProof.cancel')}
                        onPress={handleCancel}
                        disabled={isSubmitting}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="check-circle"
                        title={translate('pages.habits.checkinProof.confirm')}
                        onPress={handleConfirm}
                        loading={isSubmitting}
                        disabled={isSubmitting}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const localStyles = StyleSheet.create({
    transparentBorder: {
        borderColor: 'transparent',
    },
    prompt: {
        paddingTop: 4,
        paddingBottom: 8,
    },
    inputContainer: {
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 80,
        padding: 10,
        textAlignVertical: 'top',
        fontSize: 15,
    },
    counter: {
        alignSelf: 'flex-end',
        paddingTop: 4,
        fontSize: 12,
    },
});

export default CheckinProofSheet;
