import React from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import ImageCropPicker from 'react-native-image-crop-picker';
import analytics from '@react-native-firebase/analytics';
import mixins from '../../styles/mixins';
import Image from '../../components/BaseImage';

const { width: viewportWidth } = Dimensions.get('window');

const handleImagePress = (onImageReady, user) => {
    ImageCropPicker.openPicker(
        {
            mediaType: 'photo',
            includeBase64: false,
            height: 4 * viewportWidth,
            width: 4 * viewportWidth,
            multiple: false,
            cropping: true,
            // selectionLimit: 1,
        },
    ).then((cameraResponse) => {
        onImageReady(cameraResponse);
    }).catch((err) => {
        analytics().logEvent('user_image_upload_error', {
            userId: user?.details?.id,
        }).catch((err) => console.log(err));
        if (err?.message.toLowerCase().includes('cancel')) {
            onImageReady({
                didCancel: true,
            });
        } else if (err?.message.toLowerCase().includes('cannot find image data')) {
            // TODO: This is a bad user experience. Cropping fails with some datatypes. Upgrade dependency when fixed,
            // or start with cropping disabled, check image type and call openCrop if image is supported
            return handleImagePress(onImageReady, user);
        }
    });
};

export default ({
    user,
    onImageReady,
    theme,
    themeForms,
    userImageUri,
}) => {
    return (
        <Pressable
            onPress={() => handleImagePress(onImageReady, user)}
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
