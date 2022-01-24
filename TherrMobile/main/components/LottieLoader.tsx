import React from 'react';
import { Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
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
    theme: {
        styles: any;
    }
}

export default ({
    id,
    theme,
}: ILottieLoaderProps) => {
    let containerStyles: any = {};
    let textStyles: any = {};
    let source: any = carLoader;

    switch (id) {
        case 'donut':
            containerStyles = theme.styles.defaultContainer;
            textStyles = theme.styles.defaultText;
            source = donutLoader;
            break;
        case 'taco':
            containerStyles = theme.styles.defaultContainer;
            textStyles = theme.styles.defaultText;
            source = tacoLoader;
            break;
        case 'shopping':
            containerStyles = theme.styles.defaultContainer;
            textStyles = theme.styles.defaultText;
            source = shoppingLoader;
            break;
        case 'happy-swing':
            containerStyles = theme.styles.defaultContainer;
            textStyles = theme.styles.defaultText;
            source = happySwingLoader;
            break;
        case 'karaoke':
            containerStyles = theme.styles.karaokeContainer;
            textStyles = theme.styles.karaokeText;
            source = karaokeLoader;
            break;
        case 'zeppelin':
            containerStyles = theme.styles.defaultContainer;
            textStyles = theme.styles.defaultText;
            source = zeppelinLoader;
            break;
        case 'therr-black-rolling':
            containerStyles = theme.styles.therrBlackRollingContainer;
            textStyles = theme.styles.therrBlackRollingText;
            source = therrBlackRolling;
            break;
        case 'yellow-car':
            containerStyles = theme.styles.yellowCarContainer;
            textStyles = theme.styles.yellowCarText;
            source = carLoader;
            break;
        default:
            containerStyles = theme.styles.defaultContainer;
            textStyles = theme.styles.defaultText;
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
