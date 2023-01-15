import * as React from 'react';
import { ActivityIndicator } from 'react-native';
import { Image } from 'react-native-elements';
import { ITherrThemeColors } from '../styles/themes';

interface IBaseImageProps {
    height?: number;
    width?: number;
    source: any;
    loaderColor?: string;
    loaderSize?: number | 'small' | 'large';
    style?: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

export default ({ height, width, source, loaderColor, loaderSize, style, theme }: IBaseImageProps) => {
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
