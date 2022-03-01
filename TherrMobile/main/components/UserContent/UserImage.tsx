import React from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import ImageCropPicker from 'react-native-image-crop-picker';
import mixins from '../../styles/mixins';
import Image from '../../components/BaseImage';

const { width: viewportWidth } = Dimensions.get('window');

const handleImagePress = (onImageReady) => {
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
        if (err?.message.toLowerCase().includes('cancel')) {
            onImageReady({
                didCancel: true,
            });
        } else if (err?.message.toLowerCase().includes('cannot find image data')) {
            // TODO: This is a bad user experience. Cropping fails with some datatypes. Upgrade dependency when fixed,
            // or start with cropping disabled, check image type and call openCrop if image is supported
            return handleImagePress(onImageReady);
        }
    });
};

export default ({
    onImageReady,
    theme,
    userImageUri,
}) => {
    return (
        <Pressable
            onPress={() => handleImagePress(onImageReady)}
            style={{
                position: 'relative',
            }}
        >
            <View style={[mixins.flexCenter, mixins.marginMediumBot]}>
                <View>
                    <Image source={{ uri: userImageUri }} loaderSize="large" theme={theme} style={{
                        height: 200,
                        width: 200,
                        borderRadius: 100,
                    }} />
                    <View
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            backgroundColor: theme.colorVariations.backgroundBlackFade,
                            borderRadius: 40,
                            padding: 14,
                        }}
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
