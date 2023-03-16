import React from 'react';
import {
    Platform,
    StyleProp,
    ViewStyle,
    View,
    LayoutChangeEvent,
} from 'react-native';
import { WebView } from 'react-native-webview';
import userContentStyles from '../../styles/user-content';

interface IUserMediaProps {
    media: string;
    isDarkMode?: boolean;
    isSingleView?: boolean;
    isVisible: boolean;
    moreStyle?: StyleProp<ViewStyle>;
    onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
    overlayMsg?: string;
    viewportWidth: number;
    viewContainerStyles?: any;
}

export default ({
    media,
    isSingleView,
    isVisible,
    moreStyle,
    onLayout,
    viewportWidth,
    viewContainerStyles,
}: IUserMediaProps) => {
    const borderRadius = 0;
    const paddingHorizontal = isSingleView ? 0 : 0;
    const paddingVertical = isSingleView ? 0 : 0;
    const containerStyle: any = isSingleView
        ? {
            maxHeight: viewportWidth,
            width: viewportWidth,
            overflow: 'hidden',
            height: viewportWidth,
            ...(moreStyle as object || {}),
        }
        : {
            maxHeight: viewportWidth - (paddingVertical),
            width: viewportWidth - (paddingHorizontal),
            overflow: 'hidden',
            height: viewportWidth - (paddingVertical),
            paddingHorizontal,
            paddingVertical,
            borderRadius,
            ...(moreStyle as object || {}),
        };
    const singleViewStyles: any = isSingleView ? {
        maxHeight: viewportWidth,
        maxWidth: viewportWidth,
        width: viewportWidth,
        height: viewportWidth,
    } : {
        borderRadius,
    };
    return (
        <View style={[{ display: 'flex', position: 'relative' }, (viewContainerStyles || {})]} onLayout={onLayout}>
            {
                isVisible &&
                <WebView
                    androidLayerType={'hardware'}
                    bounces={false}
                    containerStyle={containerStyle}
                    style={[userContentStyles.webview, singleViewStyles]}
                    source={{ uri: `${media}`}}
                    overScrollMode="never"
                    scrollEnabled={false}
                    scalesPageToFit={Platform.OS === 'android'}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                />
            }
        </View>
    );
};
