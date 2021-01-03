import * as React from 'react';
import { ActivityIndicator } from 'react-native';
import { Image } from 'react-native-elements';
import styles from '../styles';
import * as therrTheme from '../styles/themes';

interface IBaseImageProps {
    source: any;
    loaderColor?: string;
    loaderSize?: number | 'small' | 'large';
    style?: any;
}

export default ({ source, loaderColor, loaderSize, style }: IBaseImageProps) => {
    const lColor = loaderColor || therrTheme.colors.primary;
    const lSize = loaderSize || 'small';

    return (
        <Image
            style={[styles.imageContainer, style]}
            source={source}
            PlaceholderContent={<ActivityIndicator size={lSize} color={lColor} />}
        />
    );
};
