import React from 'react';
import { Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import loaderStyles from '../styles/loaders';
import carLoader from '../assets/sports-car.json';
import therrBlackRolling from '../assets/therr-logo-black-rolling.json';

interface ILottieLoaderProps {
    id: 'yellow-car' | 'therr-black-rolling';
}

export default ({
    id,
}: ILottieLoaderProps) => {
    let containerStyles: any = {};
    let textStyles: any = {};
    let source: any = carLoader;

    switch (id) {
        case 'therr-black-rolling':
            containerStyles = loaderStyles.therrBlackRollingContainer;
            textStyles = loaderStyles.therrBlackRollingText;
            source = therrBlackRolling;
            break;
        case 'yellow-car':
            containerStyles = loaderStyles.yellowCarContainer;
            textStyles = loaderStyles.yellowCarText;
            source = carLoader;
            break;
        default:
            containerStyles = loaderStyles.defaultContainer;
            textStyles = loaderStyles.defaultText;
            source = carLoader;
            break;
    }

    return (
        <View style={containerStyles}>
            <LottieView
                source={source}
                // resizeMode="cover"
                speed={1}
                autoPlay
                loop
            />
            <Text style={textStyles}>Loading...</Text>
        </View>
    );
};
