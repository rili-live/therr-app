import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Dialog, Divider, Portal, Switch } from 'react-native-paper';
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

/**
 * Attaches a note or photo to a check-in that has **already been logged** — the
 * check-in button commits on the first tap, and this sheet is offered
 * afterwards from the success toast.
 *
 * Confirming re-POSTs the same (habitGoalId, date) pair: the users-service
 * upsert merges the note and proof onto the existing row, and its same-day
 * branch returns before crediting the streak again, awarding XP again or
 * re-notifying partners.
 */
interface ICheckinProofSheetProps {
    isVisible: boolean;
    isSubmitting?: boolean;
    habitName?: string;
    userId?: string;
    // When true, a "Share to the feed" row is shown (gated by the ENABLE_HABITS_FEED flag
    // upstream). Sharing requires a photo — it is what keeps the feed on-topic — so the switch
    // is disabled until an image is attached, but the row is always visible: a control that
    // only appears after an unrelated action is a control nobody finds.
    canShare?: boolean;
    // Initial position of the share switch each time the sheet opens. Callers pass the user's
    // profile-visibility setting: someone with a public profile has already said they want an
    // audience, so their check-ins default to shared; a private profile defaults to off.
    defaultSharePublicly?: boolean;
    onCancel: () => void;
    onConfirm: (args: { notes?: string; image?: ISelectedProofImage; sharePublicly?: boolean }) => void;
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
    canShare = false,
    defaultSharePublicly = false,
    onCancel,
    onConfirm,
    translate,
    themeConfirmModal,
    themeButtons,
}) => {
    const [notes, setNotes] = useState('');
    const [selectedImage, setSelectedImage] = useState<ISelectedProofImage | null>(null);
    const [imagePreviewPath, setImagePreviewPath] = useState<string>('');
    const [sharePublicly, setSharePublicly] = useState(defaultSharePublicly);

    // The sheet stays mounted between openings (it is a Portal toggled by `isVisible`), so
    // the initial state above only applies once. Re-seed on every open so a settings change
    // made after mount — or a settings fetch that resolved after it — is honoured.
    useEffect(() => {
        if (isVisible) {
            setSharePublicly(defaultSharePublicly);
        }
    }, [isVisible, defaultSharePublicly]);

    const reset = () => {
        setNotes('');
        setSelectedImage(null);
        setImagePreviewPath('');
        setSharePublicly(defaultSharePublicly);
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
            // Sharing requires a photo; never signal share without one even if the toggle was
            // left on from before the image was removed.
            sharePublicly: canShare && !!selectedImage && sharePublicly,
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
                    {translate('pages.habits.checkinProof.addDetailTitle')}
                </Dialog.Title>
                <Divider />
                <Dialog.ScrollArea style={[themeConfirmModal.styles.body, localStyles.transparentBorder]}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {habitName ? (
                            <Text style={themeConfirmModal.styles.bodyTextBold}>{habitName}</Text>
                        ) : null}
                        <Text style={[themeConfirmModal.styles.bodyText, localStyles.prompt]}>
                            {translate('pages.habits.checkinProof.addDetailPrompt')}
                        </Text>
                        <View style={localStyles.photoSection}>
                            {imagePreviewPath ? (
                                // A compact strip rather than a full-width preview: the image is
                                // already cropped square by the picker, and a large preview is what
                                // pushed the share row below the fold.
                                <View style={[localStyles.previewRow, { borderColor: themeConfirmModal.colors.textGray }]}>
                                    <Image
                                        source={{ uri: imagePreviewPath }}
                                        style={localStyles.previewThumb}
                                    />
                                    <Text
                                        numberOfLines={1}
                                        style={[themeConfirmModal.styles.bodyText, localStyles.previewLabel]}
                                    >
                                        {translate('pages.habits.checkinProof.photoAttached')}
                                    </Text>
                                    <Pressable
                                        onPress={removeImage}
                                        disabled={isSubmitting}
                                        style={localStyles.removeButton}
                                        hitSlop={8}
                                        accessibilityRole="button"
                                        accessibilityLabel={translate('pages.habits.checkinProof.removePhoto')}
                                    >
                                        <MaterialIcon name="close" size={18} color="#fff" />
                                    </Pressable>
                                </View>
                            ) : (
                                <View style={localStyles.photoButtonRow}>
                                    <Pressable
                                        onPress={() => pickImage('camera')}
                                        disabled={isSubmitting}
                                        style={({ pressed }) => [
                                            localStyles.photoButton,
                                            {
                                                borderColor: themeConfirmModal.colors.brand,
                                                backgroundColor: pressed
                                                    ? themeConfirmModal.colors.brandFaded
                                                    : themeConfirmModal.colors.surface,
                                                opacity: isSubmitting ? 0.5 : 1,
                                            },
                                        ]}
                                    >
                                        <MaterialIcon
                                            name="photo-camera"
                                            size={22}
                                            color={themeConfirmModal.colors.brand}
                                        />
                                        <Text
                                            numberOfLines={1}
                                            style={[localStyles.photoButtonLabel, { color: themeConfirmModal.colors.brand }]}
                                        >
                                            {translate('pages.habits.checkinProof.takePhoto')}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => pickImage('library')}
                                        disabled={isSubmitting}
                                        style={({ pressed }) => [
                                            localStyles.photoButton,
                                            {
                                                borderColor: themeConfirmModal.colors.brand,
                                                backgroundColor: pressed
                                                    ? themeConfirmModal.colors.brandFaded
                                                    : themeConfirmModal.colors.surface,
                                                opacity: isSubmitting ? 0.5 : 1,
                                            },
                                        ]}
                                    >
                                        <MaterialIcon
                                            name="photo-library"
                                            size={22}
                                            color={themeConfirmModal.colors.brand}
                                        />
                                        <Text
                                            numberOfLines={1}
                                            style={[localStyles.photoButtonLabel, { color: themeConfirmModal.colors.brand }]}
                                        >
                                            {translate('pages.habits.checkinProof.choosePhoto')}
                                        </Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                        {canShare ? (
                            <View style={localStyles.shareSection}>
                                <View style={[localStyles.shareRow, imagePreviewPath ? null : localStyles.shareRowInactive]}>
                                    <View style={localStyles.shareTextContainer}>
                                        <Text style={[themeConfirmModal.styles.bodyTextBold, localStyles.shareLabel]}>
                                            {translate('pages.habits.checkinProof.sharePubliclyLabel')}
                                        </Text>
                                        <Text style={[themeConfirmModal.styles.bodyText, localStyles.shareHint]}>
                                            {translate(imagePreviewPath
                                                ? 'pages.habits.checkinProof.sharePubliclyHint'
                                                : 'pages.habits.checkinProof.sharePubliclyNeedsPhoto')}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={!!imagePreviewPath && sharePublicly}
                                        onValueChange={setSharePublicly}
                                        disabled={isSubmitting || !imagePreviewPath}
                                        color={themeConfirmModal.colors.brand}
                                        accessibilityLabel={translate('pages.habits.checkinProof.sharePubliclyLabel')}
                                    />
                                </View>
                            </View>
                        ) : null}
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
                        title={translate('pages.habits.checkinProof.save')}
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
    shareSection: {
        paddingHorizontal: 10,
        paddingBottom: 12,
    },
    shareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    shareRowInactive: {
        opacity: 0.6,
    },
    shareTextContainer: {
        flex: 1,
    },
    shareLabel: {
        fontSize: 15,
    },
    shareHint: {
        fontSize: 12,
        paddingTop: 2,
    },
    photoButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        paddingTop: 4,
    },
    photoButton: {
        flex: 1,
        borderWidth: 1.5,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 4,
    },
    photoButtonLabel: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderRadius: 10,
        padding: 8,
    },
    previewThumb: {
        width: 64,
        height: 64,
        borderRadius: 8,
        resizeMode: 'cover',
    },
    previewLabel: {
        flex: 1,
        fontSize: 14,
    },
    removeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CheckinProofSheet;
