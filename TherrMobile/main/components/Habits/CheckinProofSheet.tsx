import React, { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Dialog, Divider, Portal } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import ImageCropPicker, { Image as CroppedImage } from 'react-native-image-crop-picker';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { ITherrThemeColors } from '../../styles/themes';
import ModalButton from '../Modals/ModalButton';
import { getImagePreviewPath } from '../../utilities/areaUtils';
import { requestOSCameraPermissions } from '../../utilities/requestOSPermissions';
import { showToast } from '../../utilities/toasts';

export interface ISelectedProofImage {
    path: string;
    mime: string;
    size: number;
}

interface ICheckinProofSheetProps {
    isVisible: boolean;
    isSubmitting?: boolean;
    habitName?: string;
    userId?: string;
    onCancel: () => void;
    onConfirm: (args: { notes?: string; image?: ISelectedProofImage }) => void;
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
    userId,
    onCancel,
    onConfirm,
    translate,
    themeConfirmModal,
    themeButtons,
}) => {
    const [notes, setNotes] = useState('');
    const [selectedImage, setSelectedImage] = useState<ISelectedProofImage | null>(null);
    const [imagePreviewPath, setImagePreviewPath] = useState<string>('');

    const reset = () => {
        setNotes('');
        setSelectedImage(null);
        setImagePreviewPath('');
    };

    const handleCancel = () => {
        reset();
        onCancel();
    };

    const handleConfirm = () => {
        const trimmed = notes.trim();
        onConfirm({
            notes: trimmed.length ? trimmed : undefined,
            image: selectedImage || undefined,
        });
        reset();
    };

    const pickImage = async (source: 'camera' | 'library') => {
        const pickerOptions: any = {
            mediaType: 'photo',
            includeBase64: false,
            width: 1200,
            height: 1200,
            cropping: true,
            multiple: false,
        };

        try {
            const granted = await requestOSCameraPermissions(() => {});
            const permissionsDenied = Object.keys(granted).some((key) => granted[key] !== 'granted');
            if (permissionsDenied) {
                showToast.error({
                    text1: translate('alertTitles.permissionsDenied'),
                    text2: translate('alertMessages.cameraOrFilePermissionsDenied'),
                });
                return;
            }

            const result = (source === 'camera'
                ? await ImageCropPicker.openCamera(pickerOptions)
                : await ImageCropPicker.openPicker(pickerOptions)) as CroppedImage;

            setSelectedImage({
                path: result.path,
                mime: result.mime,
                size: result.size,
            });
            setImagePreviewPath(getImagePreviewPath(result.path));
        } catch (err: any) {
            if (err?.message?.toLowerCase().includes('cancel')) {
                return;
            }
            logEvent(getAnalytics(), 'checkin_proof_picker_error', {
                platform: Platform.OS,
                userId,
            }).catch(() => {});
        }
    };

    const removeImage = () => {
        setSelectedImage(null);
        setImagePreviewPath('');
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
                        <View style={localStyles.photoSection}>
                            {imagePreviewPath ? (
                                <View style={localStyles.previewContainer}>
                                    <Image
                                        source={{ uri: imagePreviewPath }}
                                        style={localStyles.previewImage}
                                    />
                                    <Pressable
                                        onPress={removeImage}
                                        disabled={isSubmitting}
                                        style={localStyles.removeButton}
                                        hitSlop={8}
                                    >
                                        <MaterialIcon name="close" size={18} color="#fff" />
                                    </Pressable>
                                </View>
                            ) : (
                                <View style={localStyles.photoButtonRow}>
                                    <Pressable
                                        onPress={() => pickImage('camera')}
                                        disabled={isSubmitting}
                                        style={[
                                            localStyles.photoButton,
                                            { borderColor: themeConfirmModal.colors.textGray },
                                        ]}
                                    >
                                        <MaterialIcon
                                            name="photo-camera"
                                            size={20}
                                            color={themeConfirmModal.colors.textWhite}
                                        />
                                        <Text style={[localStyles.photoButtonLabel, { color: themeConfirmModal.colors.textWhite }]}>
                                            {translate('pages.habits.checkinProof.takePhoto')}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => pickImage('library')}
                                        disabled={isSubmitting}
                                        style={[
                                            localStyles.photoButton,
                                            { borderColor: themeConfirmModal.colors.textGray },
                                        ]}
                                    >
                                        <MaterialIcon
                                            name="photo-library"
                                            size={20}
                                            color={themeConfirmModal.colors.textWhite}
                                        />
                                        <Text style={[localStyles.photoButtonLabel, { color: themeConfirmModal.colors.textWhite }]}>
                                            {translate('pages.habits.checkinProof.choosePhoto')}
                                        </Text>
                                    </Pressable>
                                </View>
                            )}
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
    photoSection: {
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    photoButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    photoButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    photoButtonLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    previewContainer: {
        position: 'relative',
        width: '100%',
        aspectRatio: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CheckinProofSheet;
