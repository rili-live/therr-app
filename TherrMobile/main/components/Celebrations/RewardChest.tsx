import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ITherrThemeColors } from '../../styles/themes';
import { triggerChestOpenFeedback, triggerChestTapFeedback } from '../../utilities/rewardFeedback';

/** Duolingo's number: enough to build anticipation, few enough not to feel like a chore. */
export const CHEST_TAPS_TO_OPEN = 3;

const SUNBURST_RAY_COUNT = 16;

export interface IRewardChestResult {
    rarity: 'common' | 'rare' | 'epic' | 'jackpot';
    rewardXp: number;
}

interface IRewardChestProps {
    /** Boosted chests (a milestone or a perfect week) are drawn golden, with a sunburst. */
    isBoosted: boolean;
    /** Null until the server answers. The third tap waits for it rather than faking a number. */
    result: IRewardChestResult | null;
    /** The open request failed; the taps reset so the user can try again. */
    isError: boolean;
    isReduceMotionEnabled: boolean;
    colors: ITherrThemeColors;
    translate: (key: string, params?: any) => string;
    /** Fired on the first tap: the request goes out then, so the next two taps hide its latency. */
    onFirstTap: () => void;
    /** Fired once, when the reward has been revealed. */
    onRevealed: (result: IRewardChestResult) => void;
}

export const isBigWin = (rarity?: string) => rarity === 'epic' || rarity === 'jackpot';

/**
 * The reward chest: tap it three times to open it. Each knock wobbles it harder, with an
 * escalating haptic and a rising "tock"; the third bursts it open into the XP it held, counted
 * up from zero, with the fanfare for an epic or a jackpot (the screen adds the confetti, so it
 * covers the whole screen rather than this box).
 *
 * The amount is never decided here. It is rolled server-side (see
 * users-service `utilities/rewardChest.ts`), requested on the first tap, and only revealed once
 * it has arrived — so what the user sees is exactly what they were paid.
 *
 * Built from the app's own icon font and theme colours, like the rest of the celebration art, so
 * it takes the Friends with Habits purple and gold without a bespoke illustration.
 */
const RewardChest = ({
    isBoosted,
    result,
    isError,
    isReduceMotionEnabled,
    colors,
    translate,
    onFirstTap,
    onRevealed,
}: IRewardChestProps) => {
    const [taps, setTaps] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [displayedXp, setDisplayedXp] = useState(0);
    const wobble = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const glow = useRef(new Animated.Value(0)).current;
    const reveal = useRef(new Animated.Value(0)).current;
    const spin = useRef(new Animated.Value(0)).current;
    const countUp = useRef(new Animated.Value(0)).current;
    const cancelFeedbackRef = useRef<(() => void) | null>(null);

    // An idle pulse invites the first tap; it stops once the user starts knocking.
    useEffect(() => {
        if (isReduceMotionEnabled || taps > 0) {
            glow.setValue(0);
            return undefined;
        }
        const pulse = Animated.loop(Animated.sequence([
            Animated.timing(glow, {
                toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
            }),
            Animated.timing(glow, {
                toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
            }),
        ]));
        pulse.start();
        return () => pulse.stop();
    }, [glow, isReduceMotionEnabled, taps]);

    // A failed open hands the chest back closed, ready for another three knocks.
    useEffect(() => {
        if (isError) {
            setTaps(0);
        }
    }, [isError]);

    useEffect(() => () => {
        cancelFeedbackRef.current?.();
    }, []);

    const knock = useCallback((tapIndex: number) => {
        if (isReduceMotionEnabled) {
            return;
        }
        Animated.parallel([
            Animated.sequence([
                Animated.timing(wobble, { toValue: 1, duration: 60, useNativeDriver: true }),
                Animated.timing(wobble, { toValue: -1, duration: 90, useNativeDriver: true }),
                Animated.timing(wobble, { toValue: 0.5, duration: 70, useNativeDriver: true }),
                Animated.timing(wobble, { toValue: 0, duration: 60, useNativeDriver: true }),
            ]),
            Animated.sequence([
                Animated.timing(scale, { toValue: 1.06 + (tapIndex * 0.06), duration: 80, useNativeDriver: true }),
                Animated.spring(scale, {
                    toValue: 1 + (tapIndex * 0.04), friction: 4, tension: 160, useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, [isReduceMotionEnabled, scale, wobble]);

    // Reveal once the third knock has landed AND the server has answered, in either order.
    useEffect(() => {
        if (isRevealed || taps < CHEST_TAPS_TO_OPEN || !result) {
            return;
        }
        setIsRevealed(true);
        cancelFeedbackRef.current = triggerChestOpenFeedback(result.rarity);
        onRevealed(result);
    }, [isRevealed, onRevealed, result, taps]);

    // The burst itself. Keyed on the reveal alone, so nothing re-rendering afterwards can stop
    // the count-up halfway; `result` cannot change once revealed.
    useEffect(() => {
        if (!isRevealed || !result) {
            return undefined;
        }
        if (isReduceMotionEnabled) {
            reveal.setValue(1);
            setDisplayedXp(result.rewardXp);
            return undefined;
        }

        const listenerId = countUp.addListener(({ value }) => setDisplayedXp(Math.round(value)));
        const animation = Animated.parallel([
            Animated.spring(reveal, {
                toValue: 1, friction: 5, tension: 70, useNativeDriver: true,
            }),
            Animated.timing(countUp, {
                toValue: result.rewardXp,
                duration: 600 + Math.min(900, result.rewardXp * 15),
                delay: 150,
                easing: Easing.out(Easing.cubic),
                // Drives a JS listener, not a style, so it cannot run on the native driver.
                useNativeDriver: false,
            }),
        ]);
        animation.start(({ finished }) => {
            if (finished) {
                setDisplayedXp(result.rewardXp);
            }
        });
        const spinLoop = Animated.loop(Animated.timing(spin, {
            toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true,
        }));
        if (isBigWin(result.rarity) || isBoosted) {
            spinLoop.start();
        }

        return () => {
            animation.stop();
            spinLoop.stop();
            countUp.removeListener(listenerId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRevealed]);

    const onPress = () => {
        if (isRevealed || taps >= CHEST_TAPS_TO_OPEN) {
            return;
        }
        if (taps === 0) {
            onFirstTap();
        }
        triggerChestTapFeedback(taps);
        knock(taps);
        setTaps(taps + 1);
    };

    const chestColor = isBoosted ? colors.accent : colors.brand;
    // Each knock swings wider than the last: 6°, 11°, 16°.
    const wobbleDegrees = 6 + (Math.max(0, taps - 1) * 5);
    const isWaiting = taps >= CHEST_TAPS_TO_OPEN && !result && !isError;

    let hint: string;
    if (isError) {
        hint = translate('pages.celebration.chest.error');
    } else if (isWaiting) {
        hint = translate('pages.celebration.chest.opening');
    } else if (taps === 0) {
        hint = translate('pages.celebration.chest.hintTap', { count: CHEST_TAPS_TO_OPEN });
    } else if (taps === CHEST_TAPS_TO_OPEN - 1) {
        hint = translate('pages.celebration.chest.hintOneMore');
    } else {
        hint = translate('pages.celebration.chest.hintKeepGoing');
    }

    if (isRevealed && result) {
        const isBig = isBigWin(result.rarity);
        return (
            <View style={styles.container}>
                <Animated.View
                    style={[
                        styles.stage,
                        {
                            opacity: reveal,
                            transform: [{
                                scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                            }],
                        },
                    ]}
                    accessible
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={translate('pages.celebration.chest.revealAccessibility', {
                        rarity: translate(`pages.celebration.chest.rarity.${result.rarity}`),
                        xp: result.rewardXp,
                    })}
                >
                    {isBig || isBoosted ? (
                        <Animated.View
                            style={[styles.sunburst, {
                                transform: [{
                                    rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                                }],
                            }]}
                            pointerEvents="none"
                        >
                            {Array.from({ length: SUNBURST_RAY_COUNT }, (_, index) => (
                                <View
                                    key={`ray-${index}`}
                                    style={[styles.ray, {
                                        backgroundColor: colors.accent,
                                        transform: [{ rotate: `${(180 / SUNBURST_RAY_COUNT) * index}deg` }],
                                    }]}
                                />
                            ))}
                        </Animated.View>
                    ) : null}
                    <View style={[styles.disc, { backgroundColor: isBig ? colors.accent : colors.brand }]}>
                        <Text style={[styles.xp, { color: isBig ? colors.onAccent : colors.onBrand }]}>
                            {`+${displayedXp}`}
                        </Text>
                        <Text style={[styles.xpUnit, { color: isBig ? colors.onAccent : colors.onBrand }]}>XP</Text>
                    </View>
                </Animated.View>
                <Text style={[styles.rarity, { color: isBig ? colors.accent : colors.textWhite }]}>
                    {translate(`pages.celebration.chest.rarity.${result.rarity}`)}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Pressable
                onPress={onPress}
                disabled={isWaiting}
                accessibilityRole="button"
                accessibilityLabel={translate('pages.celebration.chest.accessibilityLabel', {
                    remaining: CHEST_TAPS_TO_OPEN - taps,
                })}
                hitSlop={24}
            >
                <View style={styles.stage}>
                    <Animated.View
                        style={[
                            styles.glow,
                            {
                                backgroundColor: isBoosted ? colors.accent : colors.brandFaded,
                                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
                                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
                            },
                        ]}
                    />
                    <Animated.View
                        style={{
                            transform: [
                                { scale },
                                {
                                    rotate: wobble.interpolate({
                                        inputRange: [-1, 1],
                                        outputRange: [`-${wobbleDegrees}deg`, `${wobbleDegrees}deg`],
                                    }),
                                },
                            ],
                        }}
                    >
                        <MaterialCommunityIcon name="treasure-chest" size={132} color={chestColor} />
                    </Animated.View>
                </View>
            </Pressable>
            <View style={styles.pips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {Array.from({ length: CHEST_TAPS_TO_OPEN }, (_, index) => (
                    <View
                        key={`pip-${index}`}
                        style={[
                            styles.pip,
                            { borderColor: chestColor },
                            index < taps ? { backgroundColor: chestColor } : null,
                        ]}
                    />
                ))}
            </View>
            <Text style={[styles.hint, { color: colors.textWhite }]}>{hint}</Text>
        </View>
    );
};

const STAGE_SIZE = 220;

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    stage: {
        width: STAGE_SIZE,
        height: STAGE_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
        width: STAGE_SIZE * 0.82,
        height: STAGE_SIZE * 0.82,
        borderRadius: (STAGE_SIZE * 0.82) / 2,
    },
    sunburst: {
        position: 'absolute',
        width: STAGE_SIZE,
        height: STAGE_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ray: {
        position: 'absolute',
        width: 5,
        height: STAGE_SIZE,
        borderRadius: 3,
        opacity: 0.35,
    },
    disc: {
        width: STAGE_SIZE * 0.66,
        height: STAGE_SIZE * 0.66,
        borderRadius: (STAGE_SIZE * 0.66) / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    xp: {
        fontSize: 56,
        lineHeight: 62,
        fontWeight: '800',
        letterSpacing: -1,
    },
    xpUnit: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 2,
    },
    rarity: {
        fontSize: 28,
        fontWeight: '800',
        marginTop: 16,
        letterSpacing: 1,
    },
    pips: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    pip: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    hint: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
        opacity: 0.9,
    },
});

export default RewardChest;
