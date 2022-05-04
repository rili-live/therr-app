import React from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import userContentStyles from '../../styles/user-content';

interface IUserMediaProps {
    media: string;
    isDarkMode?: boolean;
    isSingleView?: boolean;
    isVisible: boolean;
    overlayMsg?: string;
    viewportWidth: number;
}

export default ({
    media,
    isSingleView,
    isVisible,
    viewportWidth,
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
        }
        : {
            maxHeight: viewportWidth - (paddingVertical),
            width: viewportWidth - (paddingHorizontal),
            overflow: 'hidden',
            height: viewportWidth - (paddingVertical),
            paddingHorizontal,
            paddingVertical,
            borderRadius,
        };
    const singleViewStyles: any = isSingleView ? {} : { borderRadius };
    return (
        <View style={{ display: 'flex', position: 'relative' }}>
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
