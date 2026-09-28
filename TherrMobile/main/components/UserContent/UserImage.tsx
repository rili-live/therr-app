import React from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import ImageCropPicker from 'react-native-image-crop-picker';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import mixins from '../../styles/mixins';
import Image from '../../components/BaseImage';
import { classifyImagePickerError, reportUserImageFailure } from '../../utilities/userImage';

const { width: viewportWidth } = Dimensions.get('window');

// Past this, a profile photo is only upload weight — it renders at a few hundred px at most.
const MAX_PICKED_IMAGE_DIMENSION = 2048;

/**
 * Pick first, crop second, rather than `openPicker({ cropping: true })`.
 *
 * With cropping inside the picker, a photo the cropper cannot open (some HEIC, cloud-backed
 * and odd-format images on Android) rejects with E_NO_IMAGE_DATA_FOUND and the whole
 * selection is lost; the old handler reopened the same picker, which failed the same way on
 * the same photo. Picking with compression re-encodes to a bounded JPEG, which the cropper
 * handles, and if cropping still fails the uncropped photo is used instead of nothing.
 */
const handleImagePress = async (onImageReady, user, translate) => {
    const userId = user?.details?.id;
    const cropSize = Math.min(4 * viewportWidth, MAX_PICKED_IMAGE_DIMENSION);

    let picked;
    try {
        picked = await ImageCropPicker.openPicker({
            mediaType: 'photo',
            includeBase64: false,
            multiple: false,
            cropping: false,
            compressImageMaxWidth: MAX_PICKED_IMAGE_DIMENSION,
            compressImageMaxHeight: MAX_PICKED_IMAGE_DIMENSION,
            compressImageQuality: 0.9,
        });
    } catch (err) {
        reportUserImageFailure({ stage: 'pick', err, userId, translate });
        onImageReady({ didCancel: true });
        return;
    }

    try {
        const cropped = await ImageCropPicker.openCropper({
            path: picked.path,
            mediaType: 'photo',
            width: cropSize,
            height: cropSize,
            includeBase64: false,
        });
        onImageReady(cropped);
    } catch (err) {
        if (classifyImagePickerError(err) === 'cancelled') {
            onImageReady({ didCancel: true });
            return;
        }
        // Not surfaced to the user: they still get their photo, just not square-cropped.
        logEvent(getAnalytics(), 'user_image_crop_fallback', {
            code: String((err as any)?.code || 'unknown').slice(0, 100),
            userId,
        }).catch(() => {});
        onImageReady(picked);
    }
};

export default ({
    user,
    onImageReady,
    translate,
    theme,
    themeForms,
    userImageUri,
}) => {
    return (
        <Pressable
            onPress={() => { handleImagePress(onImageReady, user, translate); }}
            style={themeForms.styles.userImagePressableContainer}
        >
            <View style={[mixins.flexCenter, mixins.marginMediumBot]}>
                <View>
                    <Image source={{ uri: userImageUri }} loaderSize="large" theme={theme} style={themeForms.styles.userImage} />
                    <View
                        style={themeForms.styles.userImageIconOverlay}
                    >
                        <MaterialIcon
                            name="add-a-photo"
                            size={40}
                            color={theme.colors.accentTextWhite}
                        />
                    </View>
                </View>
            </View>
        </Pressable>
    );
};
