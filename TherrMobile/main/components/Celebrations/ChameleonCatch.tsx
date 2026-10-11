import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { ITherrThemeColors } from '../../styles/themes';
import { triggerGemBurstFeedback, triggerTongueFlickFeedback } from '../../utilities/rewardFeedback';

/**
 * The daily bonus reveal: the Friends with Habits chameleon, side on, on a branch, with a rock
 * across from it. Each tap shoots its tongue a little further and turns it a new colour; the
 * third tap reaches the rock, which bursts into gems — the bonus XP, counted up.
 *
 * It is **purely the reveal**. The bonus was rolled and paid on the server at the first check-in
 * of the day (users-service `handlers/helpers/dailyBonus.ts`), so nothing here is a request and
 * nothing is lost by skipping it — the screen's Continue is always there.
 *
 * Colour change is the brand's own idea of progress: the cycle is the palette the loader walks
 * (brand purple → teal → lime) and it lands on the brand gold when the catch is made. Every
 * colour comes from the theme, and the chameleon is drawn in the logo's style (round body, gold
 * stripe, turret eye) as vector art, so there is no asset to re-export.
 */

export const TAPS_TO_CATCH = 3;

/** How far the tongue gets on each tap, as a share of the gap from mouth to rock. */
const REACH = [0.34, 0.66, 1];

// Scene geometry, in dp. The SVGs below draw in the same units, so the tongue, the rock and the
// gems line up without measuring anything at runtime.
const SCENE_WIDTH = 300;
const SCENE_HEIGHT = 190;
const CHAMELEON_WIDTH = 190;
const CHAMELEON_HEIGHT = 160;
const CHAMELEON_TOP = 22;
const MOUTH = { x: 181, y: CHAMELEON_TOP + 92 };
const ROCK = {
    left: 238, top: 92, width: 56, height: 52,
};
const ROCK_CENTER = { x: ROCK.left + ROCK.width / 2, y: ROCK.top + ROCK.height / 2 };
const TONGUE_GAP = ROCK.left + 6 - MOUTH.x;
const TONGUE_THICKNESS = 7;
const TONGUE_TIP = 15;
const GEM_SIZE = 22;
const TONGUE_COLOR = '#E8577E';
/** The celebration screen's horizontal padding, both sides; the scene shrinks to fit inside it. */
const SCREEN_GUTTER = 48;

export interface IDailyBonusReveal {
    rarity: 'common' | 'rare' | 'epic' | 'jackpot';
    bonusXp: number;
}

export const isBigBonus = (rarity?: string) => rarity === 'epic' || rarity === 'jackpot';

/** More gems for a bigger bonus, within what reads as a burst rather than clutter. */
export const getGemCount = (bonusXp: number) => Math.max(5, Math.min(16, Math.round(bonusXp / 3)));

interface IChameleonCatchProps {
    bonus: IDailyBonusReveal;
    isReduceMotionEnabled: boolean;
    colors: ITherrThemeColors;
    translate: (key: string, params?: any) => string;
    /** Fired once, when the gems are out. */
    onRevealed?: () => void;
}

interface IChameleonProps {
    skin: string;
    /** The logo's back stripe; swapped off gold once the skin itself turns gold. */
    stripe: string;
    colors: ITherrThemeColors;
}

/** The chameleon, side on and facing right, curled tail and all. */
const ChameleonSide = ({ skin, stripe, colors }: IChameleonProps) => (
    <Svg width={CHAMELEON_WIDTH} height={CHAMELEON_HEIGHT} viewBox={`0 0 ${CHAMELEON_WIDTH} ${CHAMELEON_HEIGHT}`}>
        {/* Branch */}
        <Path d="M 0 136 Q 95 128 190 140 L 190 150 Q 95 140 0 148 Z" fill={colors.brandDark} opacity={0.55} />
        {/* Curled tail */}
        <Path
            d="M 46 104 Q 14 108 14 82 Q 14 60 34 60 Q 52 60 52 78 Q 52 90 40 90 Q 30 90 31 80"
            stroke={skin}
            strokeWidth={13}
            strokeLinecap="round"
            fill="none"
        />
        {/* Legs, gripping the branch */}
        <Path d="M 70 112 Q 66 128 60 140" stroke={skin} strokeWidth={10} strokeLinecap="round" fill="none" />
        <Path d="M 118 112 Q 124 128 130 141" stroke={skin} strokeWidth={10} strokeLinecap="round" fill="none" />
        {/* Body */}
        <Path d="M 40 100 Q 46 56 96 54 Q 136 52 150 80 Q 150 116 100 120 Q 52 122 40 100 Z" fill={skin} />
        {/* Head, with the casque rising behind the eye */}
        <Path d="M 128 66 Q 138 38 160 52 Q 186 72 186 92 Q 182 108 152 110 Q 132 108 128 66 Z" fill={skin} />
        {/* The logo's gold stripe, run along the back */}
        <Path d="M 58 66 Q 96 48 134 58" stroke={stripe} strokeWidth={7} strokeLinecap="round" fill="none" />
        {/* Eye turret, looking at the rock */}
        <Circle cx={158} cy={78} r={16} fill={skin} />
        <Circle cx={158} cy={78} r={10.5} fill={colors.brandingWhite} />
        <Circle cx={162} cy={79} r={5} fill={colors.brandingBlack} />
        <Circle cx={163.5} cy={77.5} r={1.6} fill={colors.brandingWhite} />
        {/* Smile, ending at the mouth the tongue leaves from */}
        <Path d="M 156 100 Q 170 104 182 93" stroke={colors.brandingBlack} strokeWidth={2.5} strokeLinecap="round" fill="none" />
    </Svg>
);

const Rock = () => (
    <Svg width={ROCK.width} height={ROCK.height} viewBox="0 0 56 52">
        <Polygon points="6,46 2,28 14,10 32,4 48,12 54,30 50,46" fill="#7D7A86" />
        <Polygon points="14,10 32,4 30,20 18,24" fill="#9C99A6" />
        <Polygon points="30,20 48,12 54,30 38,32" fill="#8B8895" />
        <Polygon points="6,46 18,24 30,20 38,32 50,46" fill="#6A6773" />
    </Svg>
);

/** One cut gem with a highlight facet. */
const Gem = ({ color }: { color: string }) => (
    <Svg width={GEM_SIZE} height={GEM_SIZE} viewBox="0 0 22 22">
        <Polygon points="5,3 17,3 21,8 11,20 1,8" fill={color} />
        <Polygon points="5,3 11,8 1,8" fill="#FFFFFF" opacity={0.55} />
        <Polygon points="11,8 21,8 11,20" fill="#000000" opacity={0.12} />
    </Svg>
);

const ChameleonCatch = ({
    bonus,
    isReduceMotionEnabled,
    colors,
    translate,
    onRevealed,
}: IChameleonCatchProps) => {
    const [taps, setTaps] = useState(0);
    const [isCaught, setIsCaught] = useState(false);
    const [displayedXp, setDisplayedXp] = useState(0);
    const tongue = useRef(new Animated.Value(0)).current;
    const bodyPulse = useRef(new Animated.Value(1)).current;
    const rockShake = useRef(new Animated.Value(0)).current;
    const rockGone = useRef(new Animated.Value(0)).current;
    const burst = useRef(new Animated.Value(0)).current;
    const countUp = useRef(new Animated.Value(0)).current;
    const cancelFeedbackRef = useRef<(() => void) | null>(null);
    const { width: windowWidth } = useWindowDimensions();
    // Drawn at a fixed size so the geometry lines up, then scaled down on narrow phones.
    const sceneScale = Math.min(1, (windowWidth - SCREEN_GUTTER) / SCENE_WIDTH);

    // Brand purple, then teal, then lime, and the brand gold once the catch is made.
    const skins = [colors.brand, colors.accentTeal, colors.accentLime, colors.accent];
    const skin = skins[Math.min(taps, skins.length - 1)];

    const gemColors = [colors.accentTeal, colors.accent, '#BFEFFF', colors.accentLime, '#FFE58A'];
    const gems = useMemo(() => {
        const count = getGemCount(bonus.bonusXp);
        // Fanned upward and outward from the rock, spread evenly so no two land together.
        return Array.from({ length: count }, (_, index) => {
            const angle = (-Math.PI * 0.95) + ((Math.PI * 0.9) * index) / Math.max(1, count - 1);
            const distance = 70 + ((index * 37) % 50);
            return {
                dx: Math.cos(angle) * distance * 0.9,
                dy: Math.sin(angle) * distance * 0.8,
                spin: (index % 2 ? 1 : -1) * (120 + ((index * 53) % 240)),
            };
        });
    }, [bonus.bonusXp]);

    useEffect(() => () => {
        cancelFeedbackRef.current?.();
    }, []);

    // The catch itself, once the third tap lands. Keyed on `isCaught` alone so a re-render
    // cannot stop the count-up halfway.
    useEffect(() => {
        if (!isCaught) {
            return undefined;
        }
        cancelFeedbackRef.current = triggerGemBurstFeedback(bonus.rarity);
        onRevealed?.();

        if (isReduceMotionEnabled) {
            rockGone.setValue(1);
            burst.setValue(1);
            setDisplayedXp(bonus.bonusXp);
            return undefined;
        }

        const listenerId = countUp.addListener(({ value }) => setDisplayedXp(Math.round(value)));
        const animation = Animated.sequence([
            // The rock shudders under the hit…
            Animated.sequence([
                Animated.timing(rockShake, { toValue: 1, duration: 50, useNativeDriver: true }),
                Animated.timing(rockShake, { toValue: -1, duration: 60, useNativeDriver: true }),
                Animated.timing(rockShake, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]),
            // …then bursts, the tongue snaps home, and the gems fly while the count climbs.
            Animated.parallel([
                Animated.timing(rockGone, { toValue: 1, duration: 180, useNativeDriver: true }),
                Animated.timing(tongue, {
                    toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: false,
                }),
                Animated.timing(burst, {
                    toValue: 1, duration: 750, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true,
                }),
                Animated.timing(countUp, {
                    toValue: bonus.bonusXp,
                    duration: 600 + Math.min(900, bonus.bonusXp * 15),
                    easing: Easing.out(Easing.cubic),
                    // Drives a JS listener, not a style, so it cannot run on the native driver.
                    useNativeDriver: false,
                }),
            ]),
        ]);
        animation.start(({ finished }) => {
            if (finished) {
                setDisplayedXp(bonus.bonusXp);
            }
        });

        return () => {
            animation.stop();
            countUp.removeListener(listenerId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCaught]);

    const onPress = () => {
        if (taps >= TAPS_TO_CATCH) {
            return;
        }
        const tapIndex = taps;
        const isCatch = tapIndex === TAPS_TO_CATCH - 1;
        triggerTongueFlickFeedback(tapIndex);
        setTaps(tapIndex + 1);

        if (isReduceMotionEnabled) {
            if (isCatch) {
                setIsCaught(true);
            }
            return;
        }

        const reach = Animated.timing(tongue, {
            toValue: REACH[tapIndex] * TONGUE_GAP,
            duration: 130 + (tapIndex * 40),
            easing: Easing.out(Easing.quad),
            // Animates a width, which the native driver cannot.
            useNativeDriver: false,
        });
        const pulse = Animated.sequence([
            Animated.timing(bodyPulse, { toValue: 1.06, duration: 90, useNativeDriver: true }),
            Animated.spring(bodyPulse, {
                toValue: 1, friction: 4, tension: 160, useNativeDriver: true,
            }),
        ]);
        if (isCatch) {
            Animated.parallel([reach, pulse]).start(() => setIsCaught(true));
        } else {
            Animated.parallel([
                Animated.sequence([
                    reach,
                    Animated.timing(tongue, {
                        toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: false,
                    }),
                ]),
                pulse,
            ]).start();
        }
    };

    let hint: string;
    if (taps === 0) {
        hint = translate('pages.celebration.bonus.hintTap');
    } else if (taps === TAPS_TO_CATCH - 1) {
        hint = translate('pages.celebration.bonus.hintOneMore');
    } else {
        hint = translate('pages.celebration.bonus.hintKeepGoing');
    }

    return (
        <View style={styles.container}>
            <Pressable
                onPress={onPress}
                disabled={isCaught}
                accessibilityRole="button"
                accessibilityLabel={translate('pages.celebration.bonus.accessibilityLabel')}
            >
                <View
                    style={[
                        styles.scene,
                        {
                            transform: [{ scale: sceneScale }],
                            marginVertical: (SCENE_HEIGHT * (sceneScale - 1)) / 2,
                            marginHorizontal: (SCENE_WIDTH * (sceneScale - 1)) / 2,
                        },
                    ]}
                >
                    <Animated.View style={[styles.chameleon, { transform: [{ scale: bodyPulse }] }]}>
                        <ChameleonSide
                            skin={skin}
                            stripe={skin === colors.accent ? colors.brandDark : colors.accent}
                            colors={colors}
                        />
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.tongue,
                            { width: tongue, backgroundColor: TONGUE_COLOR },
                        ]}
                        pointerEvents="none"
                    >
                        <View style={[styles.tongueTip, { backgroundColor: TONGUE_COLOR }]} />
                    </Animated.View>
                    <View style={[styles.ledge, { backgroundColor: colors.brandDark }]} pointerEvents="none" />
                    <Animated.View
                        style={[
                            styles.rock,
                            {
                                opacity: rockGone.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                                transform: [
                                    { translateX: rockShake.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) },
                                    { scale: rockGone.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) },
                                ],
                            },
                        ]}
                        pointerEvents="none"
                    >
                        <Rock />
                    </Animated.View>
                    {isCaught ? gems.map((gem, index) => (
                        <Animated.View
                            // Fixed set per bonus; the index is the identity.

                            key={`gem-${index}`}
                            pointerEvents="none"
                            style={[
                                styles.gem,
                                {
                                    opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] }),
                                    transform: [
                                        { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, gem.dx] }) },
                                        { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, gem.dy] }) },
                                        { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${gem.spin}deg`] }) },
                                        { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                                    ],
                                },
                            ]}
                        >
                            <Gem color={gemColors[index % gemColors.length]} />
                        </Animated.View>
                    )) : null}
                </View>
            </Pressable>
            {isCaught ? (
                <View
                    style={styles.result}
                    accessible
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={translate('pages.celebration.bonus.revealAccessibility', {
                        rarity: translate(`pages.celebration.bonus.rarity.${bonus.rarity}`),
                        xp: bonus.bonusXp,
                    })}
                >
                    <Text style={[styles.xp, { color: isBigBonus(bonus.rarity) ? colors.accent : colors.textWhite }]}>
                        {translate('pages.celebration.bonus.xp', { xp: displayedXp })}
                    </Text>
                    <Text style={[styles.rarity, { color: isBigBonus(bonus.rarity) ? colors.accent : colors.textWhite }]}>
                        {translate(`pages.celebration.bonus.rarity.${bonus.rarity}`)}
                    </Text>
                </View>
            ) : (
                <View style={styles.result}>
                    <View style={styles.pips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        {Array.from({ length: TAPS_TO_CATCH }, (_, index) => (
                            <View
                                key={`pip-${index}`}
                                style={[
                                    styles.pip,
                                    { borderColor: skins[index + 1] },
                                    index < taps ? { backgroundColor: skins[index + 1] } : null,
                                ]}
                            />
                        ))}
                    </View>
                    <Text style={[styles.hint, { color: colors.textWhite }]}>{hint}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    scene: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
    },
    chameleon: {
        position: 'absolute',
        left: 0,
        top: CHAMELEON_TOP,
    },
    tongue: {
        position: 'absolute',
        left: MOUTH.x,
        top: MOUTH.y - TONGUE_THICKNESS / 2,
        height: TONGUE_THICKNESS,
        borderRadius: TONGUE_THICKNESS / 2,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    tongueTip: {
        width: TONGUE_TIP,
        height: TONGUE_TIP,
        borderRadius: TONGUE_TIP / 2,
        marginRight: -TONGUE_TIP / 2,
    },
    rock: {
        position: 'absolute',
        left: ROCK.left,
        top: ROCK.top,
    },
    // The rock's own perch, so it is not floating in mid-air.
    ledge: {
        position: 'absolute',
        left: ROCK.left - 12,
        top: ROCK.top + ROCK.height - 4,
        width: ROCK.width + 20,
        height: 9,
        borderRadius: 5,
        opacity: 0.55,
    },
    gem: {
        position: 'absolute',
        left: ROCK_CENTER.x - GEM_SIZE / 2,
        top: ROCK_CENTER.y - GEM_SIZE / 2,
    },
    result: {
        alignItems: 'center',
        minHeight: 96,
        justifyContent: 'center',
    },
    xp: {
        fontSize: 48,
        lineHeight: 54,
        fontWeight: '800',
        letterSpacing: -1,
    },
    rarity: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 1,
        marginTop: 4,
    },
    pips: {
        flexDirection: 'row',
        gap: 10,
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
        marginTop: 12,
        textAlign: 'center',
        opacity: 0.9,
    },
});

export default ChameleonCatch;
