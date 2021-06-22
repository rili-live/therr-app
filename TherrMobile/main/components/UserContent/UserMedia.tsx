import React from 'react';
import { Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as therrTheme from '../../styles/themes';
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
    isDarkMode,
    isVisible,
    overlayMsg,
    viewportWidth,
}) => {
    const modeStyles = isDarkMode ? {
        color: therrTheme.colors.textWhite,
    } : {
        color: therrTheme.colors.beemoTextBlack,
    };

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
            {
                overlayMsg &&
                <Text
                    style={[userContentStyles.overlayText, modeStyles]}
                    numberOfLines={2}
                >
                    {overlayMsg}
                </Text>
            }
        </View>
    );
};
