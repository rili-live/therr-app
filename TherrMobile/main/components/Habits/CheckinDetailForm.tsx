import React, { useEffect, useState } from 'react';
import {
    Image, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Switch } from 'react-native-paper';
import ImageCropPicker, { Image as CroppedImage } from 'react-native-image-crop-picker';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { ITherrThemeColors } from '../../styles/themes';
import { getImagePreviewPath } from '../../utilities/areaUtils';
import { requestOSCameraPermissions } from '../../utilities/requestOSPermissions';
import { showToast } from '../../utilities/toasts';
import { ISelectedProofImage } from '../../utilities/checkinProofUpload';

export type { ISelectedProofImage };

export const MAX_NOTE_LENGTH = 500;

/**
 * The note/photo form for a check-in that has **already been logged** — the check-in button
 * commits on the first tap and this is offered afterwards, from the success toast.
 *
 * Presentational only: it owns the draft (note text, picked image, share toggle) and hands the
 * result up. It used to be the body of a Paper `Dialog`; it now renders inside the full-screen
 * `CheckinDetail` route, which is why there is no Portal, no title bar and no action row here —
 * the screen supplies its own header and footer.
 */
interface ICheckinDetailFormProps {
    isSubmitting?: boolean;
    habitName?: string;
    userId?: string;
    // When true, a "Share to the feed" row is shown (gated by the ENABLE_HABITS_FEED flag
    // upstream). Sharing requires a photo — it is what keeps the feed on-topic — so the switch
    // is disabled until an image is attached, but the row is always visible: a control that
    // only appears after an unrelated action is a control nobody finds.
    canShare?: boolean;
    // Initial position of the share switch. Callers pass the user's profile-visibility setting:
    // someone with a public profile has already said they want an audience, so their check-ins
    // default to shared; a private profile defaults to off.
    defaultSharePublicly?: boolean;
    onChange: (draft: { notes: string; image: ISelectedProofImage | null; sharePublicly: boolean }) => void;
    translate: (key: string, params?: any) => string;
    colors: ITherrThemeColors;
    styles: any;
}

const CheckinDetailForm: React.FC<ICheckinDetailFormProps> = ({
    isSubmitting = false,
    habitName,
    userId,
    canShare = false,
    defaultSharePublicly = false,
    onChange,
    translate,
    colors,
    styles: themeStyles,
}) => {
    const [notes, setNotes] = useState('');
    const [selectedImage, setSelectedImage] = useState<ISelectedProofImage | null>(null);
    const [imagePreviewPath, setImagePreviewPath] = useState<string>('');
    const [sharePublicly, setSharePublicly] = useState(defaultSharePublicly);

    // Lift the draft on every change so the screen's footer button can submit without a ref
    // into this component. Sharing requires a photo; never signal share without one even if the
    // toggle was left on before the image was removed.
    useEffect(() => {
        onChange({
            notes,
            image: selectedImage,
            sharePublicly: canShare && !!selectedImage && sharePublicly,
        });
    }, [notes, selectedImage, sharePublicly, canShare, onChange]);

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
        <View>
            {habitName ? (
                <Text style={themeStyles.formHabitName}>{habitName}</Text>
            ) : null}
            <Text style={themeStyles.formPrompt}>
                {translate('pages.habits.checkinProof.addDetailPrompt')}
            </Text>
            <View style={localStyles.photoSection}>
                {imagePreviewPath ? (
                    // A compact strip rather than a full-width preview: the image is already
                    // cropped square by the picker, and a large preview pushes the share row
                    // and the note field below the fold on a small screen.
                    <View style={[localStyles.previewRow, { borderColor: colors.textGray }]}>
                        <Image
                            source={{ uri: imagePreviewPath }}
                            style={localStyles.previewThumb}
                        />
                        <Text
                            numberOfLines={1}
                            style={[themeStyles.formBodyText, localStyles.previewLabel]}
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
                                    borderColor: colors.brand,
                                    backgroundColor: pressed ? colors.brandFaded : colors.surface,
                                    opacity: isSubmitting ? 0.5 : 1,
                                },
                            ]}
                        >
                            <MaterialIcon name="photo-camera" size={22} color={colors.brand} />
                            <Text
                                numberOfLines={1}
                                style={[localStyles.photoButtonLabel, { color: colors.brand }]}
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
                                    borderColor: colors.brand,
                                    backgroundColor: pressed ? colors.brandFaded : colors.surface,
                                    opacity: isSubmitting ? 0.5 : 1,
                                },
                            ]}
                        >
                            <MaterialIcon name="photo-library" size={22} color={colors.brand} />
                            <Text
                                numberOfLines={1}
                                style={[localStyles.photoButtonLabel, { color: colors.brand }]}
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
                            <Text style={[themeStyles.formBodyTextBold, localStyles.shareLabel]}>
                                {translate('pages.habits.checkinProof.sharePubliclyLabel')}
                            </Text>
                            <Text style={[themeStyles.formBodyText, localStyles.shareHint]}>
                                {translate(imagePreviewPath
                                    ? 'pages.habits.checkinProof.sharePubliclyHint'
                                    : 'pages.habits.checkinProof.sharePubliclyNeedsPhoto')}
                            </Text>
                        </View>
                        <Switch
                            value={!!imagePreviewPath && sharePublicly}
                            onValueChange={setSharePublicly}
                            disabled={isSubmitting || !imagePreviewPath}
                            color={colors.brand}
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
                    placeholderTextColor={colors.textGray}
                    multiline
                    maxLength={MAX_NOTE_LENGTH}
                    style={[
                        localStyles.input,
                        {
                            color: colors.textWhite,
                            borderColor: colors.textGray,
                        },
                    ]}
                    editable={!isSubmitting}
                />
                <Text style={[localStyles.counter, { color: colors.textGray }]}>
                    {notes.length}/{MAX_NOTE_LENGTH}
                </Text>
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    inputContainer: {
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        // Taller than the sheet's 80: a full screen has the room, and the note is the reason
        // most people open this.
        minHeight: 120,
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
        paddingVertical: 16,
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
        width: 72,
        height: 72,
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

export default CheckinDetailForm;
