import React from 'react';
import { Dimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { CropView } from 'react-native-image-crop-tools';
import { IUserState } from 'therr-react/types';
import CropButtonMenu from './ButtonMenu/CropButtonMenu';
import { ITherrThemeColors } from '../styles/themes';

const { width: viewportWidth } = Dimensions.get('window');

interface IImageCropViewProps {
    onImageCrop: any;
    imageUrl: any;
    isHidden: any;
    navigation: any;
    onActionButtonPress: (type: string) => any;
    componentRef: any;
    theme: {
        styles: any;
    };
    themeMenu: {
        colors: ITherrThemeColors;
        styles: any;
    },
    translate: Function;
    user: IUserState;
}

export default ({
    onImageCrop,
    imageUrl,
    isHidden,
    onActionButtonPress,
    navigation,
    componentRef,
    theme,
    themeMenu,
    translate,
    user,
}: IImageCropViewProps) => {
    if (isHidden) {
        return null;
    }

    return (
        <>
            <ScrollView
                style={[theme.styles.bodyFlex, {
                    padding: 0,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: viewportWidth,
                }]}
                contentContainerStyle={[theme.styles.bodyScroll, { minHeight: '100%' }]}
            >
                <CropView
                    sourceUrl={imageUrl}
                    style={{
                        flex: 1,
                        padding: 0,
                        margin: 0,
                    }}
                    ref={componentRef}
                    onImageCrop={onImageCrop}
                    keepAspectRatio
                    aspectRatio={{width: 1, height: 1}}
                />
            </ScrollView>
            <CropButtonMenu
                navigation={navigation}
                translate={translate}
                onActionButtonPress={onActionButtonPress}
                user={user}
                themeMenu={themeMenu}
                isAbsolute
            />
        </>
    );
};
