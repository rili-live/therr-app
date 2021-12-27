import React from 'react';
import { Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import loaderStyles from '../styles/loaders';
import karaokeLoader from '../assets/karaoke.json';
import happySwingLoader from '../assets/happy-swing.json';
import shoppingLoader from '../assets/shopping.json';
import donutLoader from '../assets/donut.json';
import tacoLoader from '../assets/taco.json';
import carLoader from '../assets/sports-car.json';
import zeppelinLoader from '../assets/zeppelin.json';
import therrBlackRolling from '../assets/therr-logo-black-rolling.json';

export type ILottieId = 'donut' | 'taco' | 'shopping' | 'happy-swing' | 'karaoke' | 'yellow-car' | 'zeppelin' | 'therr-black-rolling';
export interface ILottieLoaderProps {
    id: ILottieId;
}

export default ({
    id,
}: ILottieLoaderProps) => {
    let containerStyles: any = {};
    let textStyles: any = {};
    let source: any = carLoader;

    switch (id) {
        case 'donut':
            containerStyles = loaderStyles.defaultContainer;
            textStyles = loaderStyles.defaultText;
            source = donutLoader;
            break;
        case 'taco':
            containerStyles = loaderStyles.defaultContainer;
            textStyles = loaderStyles.defaultText;
            source = tacoLoader;
            break;
        case 'shopping':
            containerStyles = loaderStyles.defaultContainer;
            textStyles = loaderStyles.defaultText;
            source = shoppingLoader;
            break;
        case 'happy-swing':
            containerStyles = loaderStyles.defaultContainer;
            textStyles = loaderStyles.defaultText;
            source = happySwingLoader;
            break;
        case 'karaoke':
            containerStyles = loaderStyles.karaokeContainer;
            textStyles = loaderStyles.karaokeText;
            source = karaokeLoader;
            break;
        case 'zeppelin':
            containerStyles = loaderStyles.defaultContainer;
            textStyles = loaderStyles.defaultText;
            source = zeppelinLoader;
            break;
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
