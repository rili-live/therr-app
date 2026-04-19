import React from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { loaderStyles } from '../../styles';

const earthLoader = require('../../assets/earth-loader.json');

export default ({ visible, speed }) => {
    if (!visible) {
        return null;
    }

    return (
        <View style={localStyles.overlay}>
            <LottieView
                source={earthLoader}
                style={loaderStyles.lottie}
                speed={speed}
                autoPlay
                loop
            />
        </View>
    );
};

const localStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
});
