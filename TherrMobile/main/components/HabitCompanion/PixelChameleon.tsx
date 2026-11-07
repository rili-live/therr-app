import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { CompanionStageId } from '../../utilities/companionGrowth';
import { triggerCompanionTapFeedback } from '../../utilities/rewardFeedback';
import SpriteLayer, { getSnappedPixelSize } from './SpriteLayer';
import {
    BRANCH_ROWS,
    COMPANION_SKIN_COUNT,
    COMPANION_SPRITES,
    getCompanionPalette,
    getCreatureRows,
    ICompanionThemeColors,
    SPRITE_SIZE,
} from './sprites';

// The egg pivots on its base where it rests on the branch (row 21 of 24), not on its
// middle, so the wobble rocks it in place instead of swinging it through the bough.
const EGG_PIVOT = `50% ${(21 / SPRITE_SIZE) * 100}%`;

const styles = StyleSheet.create({
    branchLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
});

interface IPixelChameleonProps {
    stageId: CompanionStageId;
    themeColors: ICompanionThemeColors;
    // Rendered edge length in dp; snapped down to whole device pixels per sprite pixel.
    size: number;
    accessibilityLabel: string;
    accessibilityHint?: string;
}

/**
 * The habit companion's sprite. Idles with a slow bob (the egg wobbles instead); a tap
 * makes it hop and change color — it is a chameleon. The color is session-only and
 * deliberately not persisted: it is a toy, not a setting.
 */
const PixelChameleon = ({
    stageId,
    themeColors,
    size,
    accessibilityLabel,
    accessibilityHint,
}: IPixelChameleonProps) => {
    const [skinIndex, setSkinIndex] = useState(0);
    const [isReduceMotion, setIsReduceMotion] = useState(false);
    const idle = useRef(new Animated.Value(0)).current;
    const hop = useRef(new Animated.Value(0)).current;

    const pixelSize = getSnappedPixelSize(size);
    const renderSize = pixelSize * SPRITE_SIZE;
    const isEgg = stageId === 'egg';

    const creatureRows = useMemo(() => getCreatureRows(COMPANION_SPRITES[stageId] || COMPANION_SPRITES.egg), [stageId]);
    const creaturePalette = useMemo(() => getCompanionPalette(themeColors, skinIndex), [themeColors, skinIndex]);
    const branchPalette = useMemo(() => getCompanionPalette(themeColors), [themeColors]);

    useEffect(() => {
        let isMounted = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then((enabled) => { if (isMounted) setIsReduceMotion(!!enabled); })
            .catch(() => { /* Treat an unanswered query as motion allowed. */ });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            setIsReduceMotion(!!enabled);
        });
        return () => {
            isMounted = false;
            subscription?.remove();
        };
    }, []);

    useEffect(() => {
        if (isReduceMotion) {
            idle.setValue(0);
            return undefined;
        }
        // The egg rests most of the cycle and then gives a quick wobble, as if something
        // inside is stirring; everything that has hatched breathes with a slow, even bob.
        const loop = isEgg
            ? Animated.loop(Animated.sequence([
                Animated.delay(1800),
                Animated.timing(idle, { toValue: 1, duration: 140, easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(idle, { toValue: -1, duration: 220, easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(idle, { toValue: 0, duration: 140, easing: Easing.linear, useNativeDriver: true }),
            ]))
            : Animated.loop(Animated.sequence([
                Animated.timing(idle, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(idle, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]));
        // Restart from rest: a stage change (egg → hatchling) swaps the loop mid-cycle.
        idle.setValue(0);
        loop.start();
        return () => loop.stop();
    }, [idle, isEgg, isReduceMotion]);

    const onPress = () => {
        triggerCompanionTapFeedback();
        setSkinIndex((prev) => (prev + 1) % COMPANION_SKIN_COUNT);
        if (isReduceMotion) return;
        hop.setValue(0);
        Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(hop, { toValue: 0, duration: 220, easing: Easing.bounce, useNativeDriver: true }),
        ]).start();
    };

    // Movement is in whole sprite pixels so the art never lands between device pixels.
    const transform = isEgg
        ? [
            { translateY: Animated.multiply(hop, -pixelSize * 3) },
            { rotate: idle.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) },
        ]
        : [
            { translateY: Animated.add(
                Animated.multiply(idle, -pixelSize),
                Animated.multiply(hop, -pixelSize * 4),
            ) },
        ];

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            onPress={onPress}
            hitSlop={8}
        >
            <View style={{ width: renderSize, height: renderSize }}>
                <SpriteLayer rows={BRANCH_ROWS} palette={branchPalette} renderSize={renderSize} style={styles.branchLayer} />
                <Animated.View
                    style={{
                        width: renderSize,
                        height: renderSize,
                        transform,
                        ...(isEgg ? { transformOrigin: EGG_PIVOT } : {}),
                    }}
                >
                    <SpriteLayer rows={creatureRows} palette={creaturePalette} renderSize={renderSize} />
                </Animated.View>
            </View>
        </Pressable>
    );
};

export default PixelChameleon;
