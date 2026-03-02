import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image as RNImage,
    ImageResizeMode,
    ImageSourcePropType,
    ImageStyle,
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { ITherrThemeColors } from '../styles/themes';

// ---------------------------------------------------------------------------
// Named export: drop-in replacement for react-native-elements Image.
// Matches the RNE API surface used throughout the app: source, style,
// PlaceholderContent, height, width, containerStyle, resizeMode, transition.
// ---------------------------------------------------------------------------

interface IImageProps {
    source: ImageSourcePropType;
    style?: StyleProp<ImageStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    height?: number;
    width?: number;
    resizeMode?: ImageResizeMode;
    PlaceholderContent?: React.ReactElement;
    onPress?: () => void;
    // Accepted for compat but ignored
    transition?: boolean;
}

export const Image = ({
    source,
    style,
    containerStyle,
    height,
    width,
    resizeMode,
    PlaceholderContent,
    onPress,
}: IImageProps) => {
    const [loading, setLoading] = useState(true);

    const sizeStyle: ImageStyle = {};
    if (height != null) { sizeStyle.height = height; }
    if (width != null) { sizeStyle.width = width; }

    const imageElement = (
        <View style={containerStyle}>
            <RNImage
                source={source}
                style={[sizeStyle, style]}
                resizeMode={resizeMode}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
            />
            {loading && PlaceholderContent && (
                <View style={styles.placeholder}>
                    {PlaceholderContent}
                </View>
            )}
        </View>
    );

    if (onPress) {
        return <Pressable onPress={onPress}>{imageElement}</Pressable>;
    }
    return imageElement;
};

const styles = StyleSheet.create({
    placeholder: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

// ---------------------------------------------------------------------------
// Default export: themed BaseImage used by Login, UserImage, etc.
// ---------------------------------------------------------------------------

interface IBaseImageProps {
    height?: number;
    width?: number;
    source: ImageSourcePropType;
    loaderColor?: string;
    loaderSize?: number | 'small' | 'large';
    style?: StyleProp<ImageStyle>;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const BaseImage = ({ height, width, source, loaderColor, loaderSize, style, theme }: IBaseImageProps) => {
    const lColor = loaderColor || theme.colors.primary;
    const lSize = loaderSize || 'small';

    return (
        <Image
            height={height}
            width={width}
            style={[theme.styles.imageContainer, style]}
            source={source}
            PlaceholderContent={<ActivityIndicator size={lSize} color={lColor} />}
        />
    );
};

export default BaseImage;
