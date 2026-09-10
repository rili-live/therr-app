
import React from 'react';
import {
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import LottieView from 'lottie-react-native';
import missingImageDeals from '../../assets/missing-image-deals.json';
import missingImageEvents from '../../assets/missing-image-events.json';
import missingImageFood from '../../assets/missing-image-food.json';
import missingImageStorefront from '../../assets/missing-image-storefront.json';
import missingImageIdea from '../../assets/missing-image-idea.json';
import missingImageMusic from '../../assets/missing-image-music.json';
import missingImageNature from '../../assets/missing-image-nature.json';
import BrandedMediaPlaceholder from './BrandedMediaPlaceholder';
import { ITherrThemeColors } from '../../styles/themes';

interface IMissingImagePlaceholder {
    area: any;
    themeViewArea: any;
    theme: {
        styles: any;
        colors: ITherrThemeColors;
    };
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
    theme,
    placeholderMediaType,
    dimensions,
}: IMissingImagePlaceholder) => {
    if (area?.category) {
        let lottieStyle: StyleProp<ViewStyle> = localStyles.lottie;
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
            lottieStyle = localStyles.lottieEvent;
        }

        return (
            <View style={[
                themeViewArea.styles.cardImage,
                dimensions ? dimensions : {},
                localStyles.container,
                { backgroundColor: theme.colors.surfaceAlt },
            ]}>
                <LottieView
                    source={missingImage}
                    resizeMode="contain"
                    speed={placeholderMediaType === 'autoplay' ? 1 : 3}
                    autoPlay
                    loop={false}
                    style={lottieStyle}
                />
            </View>
        );
    }

    // Uncategorized content used to fall back to a generic grey "broken image"
    // PNG, which read as a load failure rather than as "no photo yet". The
    // branded placeholder is theme-derived, so it also picks up any niche
    // brand's palette without shipping a per-brand asset.
    return (
        <View style={[themeViewArea.styles.cardImage, dimensions ? dimensions : {}, localStyles.container]}>
            <BrandedMediaPlaceholder
                seed={area?.id}
                areaType={area?.areaType}
                width={dimensions?.width}
                height={dimensions?.height}
                theme={theme}
            />
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    lottie: {
        flex: 1,
    },
    lottieEvent: {
        flex: 1,
        margin: '5%',
    },
});

export default MissingImagePlaceholder;
