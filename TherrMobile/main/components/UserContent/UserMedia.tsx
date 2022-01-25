import React from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import userContentStyles from '../../styles/user-content';

interface IUserMediaProps {
    media: string;
    isDarkMode?: boolean;
    isVisible: boolean;
    overlayMsg?: string;
    viewportWidth: number;
}

export default ({
    media,
    isVisible,
    viewportWidth,
}: IUserMediaProps) => {
    return (
        <View style={{ display: 'flex', position: 'relative' }}>
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
