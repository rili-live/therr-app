
import React from 'react';
import {
    ActivityIndicator,
    StyleProp,
    View,
} from 'react-native';
import { Image } from 'react-native-elements';
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
        let missingImage: any = missingImageFood;
        if (area?.category?.includes('food') || area?.category?.includes('menu')) {
            missingImage = missingImageFood;
        }
        if (area?.category?.includes('deals') || area?.category?.includes('discount') || area?.category?.includes('coupon')) {
            missingImage = missingImageDeals;
        }
        if (area?.category?.includes('storefront') || area?.category?.includes('artwork')) {
            missingImage = missingImageStorefront;
        }
        if (area?.category?.includes('idea')) {
            missingImage = missingImageIdea;
        }
        if (area?.category?.includes('music')) {
            missingImage = missingImageMusic;
        }
        if (area?.category?.includes('nature')) {
            missingImage = missingImageNature;
        }
        if (area?.category?.includes('event') || area?.areaType === 'events') {
            missingImage = missingImageEvents;
            lottieStyle = {position: 'absolute', width: '90%', height: '90%', margin: '5%' };
        }

        return (
            <View style={[themeViewArea.styles.cardImage, dimensions ? dimensions : {}]}>
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

export default MissingImagePlaceholder;
