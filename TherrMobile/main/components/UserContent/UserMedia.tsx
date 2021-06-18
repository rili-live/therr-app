import React from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default ({
    media,
    isVisible,
    viewportWidth,
}) => {
    if (!isVisible) {
        return null;
    }

    return (
        <WebView
            bounces={false}
            containerStyle={{ maxHeight: viewportWidth, width: viewportWidth, overflow: 'hidden', height: viewportWidth }}
            style={{ overflow: 'hidden' }}
            source={{ uri: `${media}`}}
            overScrollMode="never"
            scrollEnabled={false}
            scalesPageToFit={Platform.OS === 'android'}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
        />
    );
};
