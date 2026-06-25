import React, { useState } from 'react';
import {
    ActivityIndicator,
    ImageResizeMode,
    StyleSheet,
    View,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { Image } from '../BaseImage';
import PressableWithDoubleTap from '../PressableWithDoubleTap';
import { ITherrThemeColors } from '../../styles/themes';

interface IMultiPhotoCarouselProps {
    // Resolved image URIs (already capped to the max photo count by the caller).
    uris: string[];
    width: number;
    height: number;
    resizeMode?: ImageResizeMode;
    onPress?: () => void;
    onDoubleTap?: () => void;
    theme: { colors: ITherrThemeColors };
}

/**
 * A simple, swipeable photo carousel for multi-photo moments. Swipe (or tap a page) moves
 * between photos; tap opens the moment (onPress) and double-tap likes it (onDoubleTap),
 * matching the single-photo gestures. Page dots indicate position. A single photo renders
 * without any carousel chrome. See docs/LIVE_MOMENTS_PLAN.md.
 */
const MultiPhotoCarousel = ({
    uris,
    width,
    height,
    resizeMode = 'contain',
    onPress,
    onDoubleTap,
    theme,
}: IMultiPhotoCarouselProps) => {
    const [activeIndex, setActiveIndex] = useState(0);

    const renderImage = (uri: string, key: string | number) => (
        <PressableWithDoubleTap
            key={key}
            style={{ width, height }}
            onPress={onPress}
            onDoubleTap={onDoubleTap || (() => {})}
        >
            <Image
                source={{ uri }}
                style={{ width, height }}
                resizeMode={resizeMode}
                PlaceholderContent={<ActivityIndicator color={theme.colors.brandingBlueGreen} />}
            />
        </PressableWithDoubleTap>
    );

    // Single photo: no pager / dots.
    if (uris.length <= 1) {
        return renderImage(uris[0], 0);
    }

    return (
        <View style={{ width, height }}>
            <PagerView
                style={{ width, height }}
                initialPage={0}
                onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
            >
                {uris.map((uri, index) => (
                    <View key={`page-${index}`} style={{ width, height }}>
                        {renderImage(uri, index)}
                    </View>
                ))}
            </PagerView>
            <View style={localStyles.dotsContainer} pointerEvents="none">
                {uris.map((_, index) => (
                    <View
                        key={`dot-${index}`}
                        style={[
                            localStyles.dot,
                            {
                                backgroundColor: index === activeIndex
                                    ? theme.colors.brandingWhite
                                    : 'rgba(255,255,255,0.5)',
                            },
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    dotsContainer: {
        position: 'absolute',
        bottom: 10,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginHorizontal: 3,
    },
});

export default MultiPhotoCarousel;
