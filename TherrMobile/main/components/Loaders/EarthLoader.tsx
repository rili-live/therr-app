import React from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import { loaderStyles } from '../../styles';
import { getTheme } from '../../styles/themes';
import { OVERLAY_LIGHT } from '../../styles/themes/brandConstants';
import ChameleonLoader from './ChameleonLoader';

const earthLoader = require('../../assets/earth-loader.json');

// Full-screen overlays (map boot, email verification) render outside any themed
// tree, so the brand's default theme is the palette the chameleon takes its
// colours from. `getTheme()` resolves the brand from `CURRENT_BRAND_VARIATION`.
const overlayTheme = getTheme();

export default ({ visible, speed }) => {
    if (!visible) {
        return null;
    }

    return (
        <View style={localStyles.overlay}>
            {CURRENT_BRAND_VARIATION === BrandVariations.HABITS ? (
                <ChameleonLoader
                    size={loaderStyles.lottie.width}
                    speed={speed}
                    theme={overlayTheme}
                />
            ) : (
                <LottieView
                    source={earthLoader}
                    style={loaderStyles.lottie}
                    speed={speed}
                    autoPlay
                    loop
                />
            )}
        </View>
    );
};

const localStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: OVERLAY_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
});
