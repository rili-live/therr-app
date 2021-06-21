import React from 'react';
import { Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import userContentStyles from '../../styles/user-content';

interface IUserMediaProps {
    media: string;
    isVisible: boolean;
    overlayMsg?: string;
    viewportWidth: number;
}

export default ({
    media,
    isVisible,
    overlayMsg,
    viewportWidth,
}) => {
    return (
        <View style={{ display: 'flex', position: 'relative' }}>
            {
                overlayMsg &&
                <Text
                    style={userContentStyles.overlayText}
                    numberOfLines={2}
                >
                    {overlayMsg}
                </Text>
            }
            {
                isVisible &&
                <WebView
                    bounces={false}
                    containerStyle={{
                        maxHeight: viewportWidth,
                        width: viewportWidth,
                        overflow: 'hidden',
                        height: viewportWidth,
                    }}
                    style={userContentStyles.webview}
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
