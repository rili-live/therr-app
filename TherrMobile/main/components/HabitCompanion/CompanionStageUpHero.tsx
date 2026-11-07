import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { CompanionStageId } from '../../utilities/companionGrowth';
import PixelChameleon from './PixelChameleon';
import SpriteLayer, { getSnappedPixelSize } from './SpriteLayer';
import {
    BRANCH_ROWS,
    COMPANION_SPRITES,
    getCompanionPalette,
    getCreatureRows,
    ICompanionThemeColors,
    SPRITE_SIZE,
} from './sprites';

// Where the sparkles fly to, in sprite pixels from the centre: a ring of eight, so the burst
// reads as radiating rather than as a handful of dots.
const SPARKLE_VECTORS: ReadonlyArray<[number, number]> = [
    [0, -11], [8, -8], [11, 0], [8, 8], [0, 11], [-8, 8], [-11, 0], [-8, -8],
];

const SHAKE_MS = 900;
const REVEAL_MS = 520;

const styles = StyleSheet.create({
    layer: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    centered: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

interface ICompanionStageUpHeroProps {
    fromStageId: CompanionStageId;
    stageId: CompanionStageId;
    themeColors: ICompanionThemeColors;
    size: number;
    isReduceMotionEnabled: boolean;
    accessibilityLabel: string;
    accessibilityHint?: string;
    /** Fires once the new stage is fully revealed (immediately under Reduce Motion). */
    onRevealed?: () => void;
}

/**
 * The stage-up moment: the chameleon as the user last saw it shakes with something about to
 * happen, a flash and a ring of pixel sparkles cover the change, and the new stage springs in.
 * Once revealed it hands over to the ordinary PixelChameleon — same frame at rest, so there is
 * no visible swap — which idles and can be tapped to change color like the one on the card.
 *
 * Under Reduce Motion the new stage is shown straight away.
 */
const CompanionStageUpHero = ({
    fromStageId,
    stageId,
    themeColors,
    size,
    isReduceMotionEnabled,
    accessibilityLabel,
    accessibilityHint,
    onRevealed,
}: ICompanionStageUpHeroProps) => {
    const [isRevealed, setIsRevealed] = useState(isReduceMotionEnabled);
    const shake = useRef(new Animated.Value(0)).current;
    const reveal = useRef(new Animated.Value(0)).current;
    const onRevealedRef = useRef(onRevealed);
    onRevealedRef.current = onRevealed;

    const pixelSize = getSnappedPixelSize(size);
    const renderSize = pixelSize * SPRITE_SIZE;

    const palette = useMemo(() => getCompanionPalette(themeColors), [themeColors]);
    const fromRows = useMemo(() => getCreatureRows(COMPANION_SPRITES[fromStageId] || COMPANION_SPRITES.egg), [fromStageId]);
    const toRows = useMemo(() => getCreatureRows(COMPANION_SPRITES[stageId] || COMPANION_SPRITES.egg), [stageId]);

    useEffect(() => {
        if (isReduceMotionEnabled) {
            setIsRevealed(true);
            onRevealedRef.current?.();
            return undefined;
        }
        shake.setValue(0);
        reveal.setValue(0);
        const animation = Animated.sequence([
            Animated.timing(shake, { toValue: 1, duration: SHAKE_MS, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(reveal, { toValue: 1, duration: REVEAL_MS, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
        ]);
        animation.start(({ finished }) => {
            if (finished) {
                setIsRevealed(true);
                onRevealedRef.current?.();
            }
        });
        return () => animation.stop();
    }, [isReduceMotionEnabled, shake, reveal]);

    if (isRevealed) {
        return (
            <PixelChameleon
                stageId={stageId}
                themeColors={themeColors}
                size={size}
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={accessibilityHint}
            />
        );
    }

    // A shake that builds: small rocks early, wider ones just before the change.
    const shakeRotate = shake.interpolate({
        inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.7, 0.8, 0.9, 1],
        outputRange: ['0deg', '-2deg', '2deg', '-3deg', '3deg', '-5deg', '5deg', '-6deg', '0deg'],
    });
    const fromOpacity = reveal.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' });
    const toOpacity = reveal.interpolate({ inputRange: [0.2, 0.5], outputRange: [0, 1], extrapolate: 'clamp' });
    const toScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
    const flashOpacity = reveal.interpolate({ inputRange: [0, 0.15, 0.6], outputRange: [0, 0.9, 0], extrapolate: 'clamp' });
    const flashScale = reveal.interpolate({ inputRange: [0, 0.6], outputRange: [0.2, 1.3], extrapolate: 'clamp' });
    const sparkleOpacity = reveal.interpolate({ inputRange: [0, 0.2, 0.85, 1], outputRange: [0, 1, 1, 0] });
    const flashSize = renderSize * 0.8;
    const sparkleSize = pixelSize * 2;

    return (
        <View
            style={{ width: renderSize, height: renderSize }}
            accessible
            accessibilityLabel={accessibilityLabel}
        >
            <SpriteLayer rows={BRANCH_ROWS} palette={palette} renderSize={renderSize} style={styles.layer} />
            <Animated.View
                style={[
                    styles.centered,
                    {
                        top: (renderSize - flashSize) / 2,
                        left: (renderSize - flashSize) / 2,
                        width: flashSize,
                        height: flashSize,
                        borderRadius: flashSize / 2,
                        backgroundColor: themeColors.brandingWhite,
                        opacity: flashOpacity,
                        transform: [{ scale: flashScale }],
                    },
                ]}
            />
            <Animated.View
                style={[styles.layer, { opacity: fromOpacity, transform: [{ rotate: shakeRotate }] }]}
            >
                <SpriteLayer rows={fromRows} palette={palette} renderSize={renderSize} />
            </Animated.View>
            <Animated.View
                style={[styles.layer, { opacity: toOpacity, transform: [{ scale: toScale }] }]}
            >
                <SpriteLayer rows={toRows} palette={palette} renderSize={renderSize} />
            </Animated.View>
            {SPARKLE_VECTORS.map(([dx, dy], index) => (
                <Animated.View
                    key={`${dx},${dy}`}
                    style={[
                        styles.layer,
                        {
                            top: (renderSize - sparkleSize) / 2,
                            left: (renderSize - sparkleSize) / 2,
                            width: sparkleSize,
                            height: sparkleSize,
                            backgroundColor: index % 2 ? themeColors.accent : themeColors.accentTeal,
                            opacity: sparkleOpacity,
                            transform: [
                                { translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, dx * pixelSize] }) },
                                { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, dy * pixelSize] }) },
                            ],
                        },
                    ]}
                />
            ))}
        </View>
    );
};

export default CompanionStageUpHero;
