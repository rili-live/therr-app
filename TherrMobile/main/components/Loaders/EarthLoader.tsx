import React from 'react';
import AnimatedLoader from 'react-native-animated-loader';
import { loaderStyles } from '../../styles';

const earthLoader = require('../../assets/earth-loader.json');

export default ({ visible, speed }) => (
    <AnimatedLoader
        visible={visible}
        overlayColor="rgba(255,255,255,0.75)"
        source={earthLoader}
        animationStyle={loaderStyles.lottie}
        speed={speed}
    />
);
