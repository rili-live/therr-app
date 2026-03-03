
import React from 'react';
import {
    ActivityIndicator,
    StyleProp,
    StyleSheet,
    View,
} from 'react-native';
import { Image } from '../BaseImage';
import LottieView from 'lottie-react-native';
import missingImageDeals from '../../assets/missing-image-deals.json';
import missingImageEvents from '../../assets/missing-image-events.json';
import missingImageFood from '../../assets/missing-image-food.json';
import missingImageStorefront from '../../assets/missing-image-storefront.json';
import missingImageIdea from '../../assets/missing-image-idea.json';
import missingImageMusic from '../../assets/missing-image-music.json';
import missingImageNature from '../../assets/missing-image-nature.json';
import { ViewStyle } from 'react-native';

const placeholderMedia = require('../../assets/placeholder-content-media.png');

interface IMissingImagePlaceholder {
    area: any;
    themeViewArea: any;
    placeholderMediaType?: string;
    dimensions?: {
        height: number;
        width: number;
    };
}

// TODO: Implement Categories.ts
const MissingImagePlaceholder = ({
    area,
    themeViewArea,
    placeholderMediaType,
    dimensions,
}: IMissingImagePlaceholder) => {
    if (area?.category) {
        let lottieStyle: StyleProp<ViewStyle> = {position: 'absolute', width: '100%', height: '100%' };
        let missingImage: any = missingImageStorefront;
        const cat = area.category;
        if (cat.includes('food') || cat.includes('menu') || cat.includes('restaurant') || cat.includes('cafe')) {
            missingImage = missingImageFood;
        }
        if (cat.includes('deals') || cat.includes('discount') || cat.includes('coupon')) {
            missingImage = missingImageDeals;
        }
        if (cat.includes('storefront') || cat.includes('artwork') || cat.includes('shop') || cat.includes('retail')) {
            missingImage = missingImageStorefront;
        }
        if (cat.includes('idea')) {
            missingImage = missingImageIdea;
        }
        if (cat.includes('music')) {
            missingImage = missingImageMusic;
        }
        if (cat.includes('nature') || cat.includes('outdoor') || cat.includes('park')
            || cat.includes('fitness') || cat.includes('wellness') || cat.includes('yoga')
            || cat.includes('health') || cat.includes('sport')) {
            missingImage = missingImageNature;
        }
        if (cat.includes('event') || area?.areaType === 'events') {
            missingImage = missingImageEvents;
            lottieStyle = {position: 'absolute', width: '90%', height: '90%', margin: '5%' };
        }

        return (
            <View style={[themeViewArea.styles.cardImage, dimensions ? dimensions : {}, localStyles.container]}>
                <LottieView
                    source={missingImage}
                    resizeMode="contain"
                    speed={1}
                    progress={placeholderMediaType === 'autoplay' ? 0 : 1}
                    autoPlay={placeholderMediaType === 'autoplay'}
                    loop={false}
                    style={[lottieStyle]}
                />
            </View>
        );
    }

    return (
        <Image
            source={placeholderMedia}
            style={themeViewArea.styles.cardImage}
            resizeMode="cover"
            PlaceholderContent={<ActivityIndicator />}
        />
    );
};

const localStyles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
});

export default MissingImagePlaceholder;
