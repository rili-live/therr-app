import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    ReduceMotion,
    SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { ITherrThemeColors } from '../../../styles/themes';
import { triggerGemBurstFeedback, triggerTongueFlickFeedback } from '../../../utilities/rewardFeedback';
import { ChameleonBody, ChameleonLimbs, IRigValues } from './ChameleonRig';
import Gems from './Gems';
import {
    GAZE,
    GEM_PILE,
    LIMB_WIDTH_FAR,
    LIMB_WIDTH_NEAR,
    LIMBS_FAR,
    LIMBS_NEAR,
    ROCK,
    SCENE_HEIGHT,
    SCENE_WIDTH,
    SCREEN_GUTTER,
    TONGUE,
} from './geometry';
import * as motion from './motion';
import { getScenePalette, GOLD_SKIN } from './palette';
import { getGemFlights } from './rig';
import {
    Branch,
    BurstRing,
    Hill,
    IRockValues,
    Rock,
    Shards,
} from './Scenery';

/**
 * The daily bonus reveal: the Friends with Habits chameleon, side on, on a stick, with a rock
 * across from it. Each tap shoots its tongue a little further and turns it a new colour; the
 * third tap reaches the rock, which bursts into gems that land in a pile — the bonus XP,
 * counted up.
 *
 * It is **purely the reveal**. The bonus was rolled and paid on the server at the first check-in
 * of the day (users-service `handlers/helpers/dailyBonus.ts`), so nothing here is a request and
 * nothing is lost by skipping it — the screen's Continue is always there.
 *
 * Everything that moves runs on the UI thread (shared values, `useAnimatedProps` on SVG paths).
 * The JS thread only keeps the milestones — revealed, counted — and fires the haptic and sound
 * cues, on timers keyed to the same constants as the animations (`motion.ts`), so the cues land
 * on the contact and burst frames. The timeline, the drawing and the colour mapping are the
 * approved motion spec; `geometry.ts` holds every coordinate.
 */

export const TAPS_TO_CATCH = 3;

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

/** Stands in for the amount in the translated "+{xp} XP", so the UI thread can count into it. */
const XP_TOKEN = '\u0007';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const ease = {
    outQuad: Easing.out(Easing.quad),
    inCubic: Easing.in(Easing.cubic),
    outCubic: Easing.out(Easing.cubic),
    inOutCubic: Easing.inOut(Easing.cubic),
    inOutSine: Easing.inOut(Easing.sin),
    /** An elastic overshoot of about 10% (the CSS "ease-out-back" curve). */
    outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
};
/** The cross-fades the reduced-motion path keeps are colour and opacity, not motion. */
const ALWAYS = ReduceMotion.Never;

type Phase = 'aiming' | 'revealed' | 'counted';

/** The idle blinks, on their fixed table of gaps, looping. */
const blinkLoop = () => {
    const blinks = motion.BLINK_GAPS_MS.flatMap((gap, index) => {
        const once = [
            withDelay(gap, withTiming(1, { duration: motion.BLINK_CLOSE_MS, easing: Easing.in(Easing.quad) })),
            withDelay(motion.BLINK_HOLD_MS, withTiming(0, { duration: motion.BLINK_OPEN_MS, easing: ease.outQuad })),
        ];
        if ((index + 1) % motion.BLINK_DOUBLE_EVERY !== 0) {
            return once;
        }
        return [
            ...once,
            withDelay(motion.BLINK_DOUBLE_GAP_MS, withTiming(1, { duration: motion.BLINK_CLOSE_MS })),
            withDelay(motion.BLINK_HOLD_MS, withTiming(0, { duration: motion.BLINK_OPEN_MS, easing: ease.outQuad })),
        ];
    });
    return withRepeat(withSequence(...blinks), -1, false);
};


const ChameleonCatch = ({
    bonus,
    isReduceMotionEnabled,
    colors,
    translate,
    onRevealed,
}: IChameleonCatchProps) => {
    const palette = useMemo(() => getScenePalette(colors), [colors]);
    const [taps, setTaps] = useState(0);
    const [phase, setPhase] = useState<Phase>('aiming');
    // Taps are counted in a ref as well, so two taps inside one render both register.
    const tapsRef = useRef(0);
    const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const cancelFeedbackRef = useRef<(() => void) | null>(null);
    const { width: windowWidth } = useWindowDimensions();
    // Drawn at a fixed size so the geometry lines up, then scaled down on narrow phones.
    const sceneScale = Math.min(1, (windowWidth - SCREEN_GUTTER) / SCENE_WIDTH);

    // ---- Shared values ----------------------------------------------------------------------
    const skin = useSharedValue(0);
    const breath = useSharedValue(0);
    const coil = useSharedValue(-1);
    const squash = useSharedValue(0);
    const rise = useSharedValue(0);
    const headX = useSharedValue(0);
    const tilt = useSharedValue(0);
    const reach = useSharedValue(0);
    const contact = useSharedValue(0);
    const blink = useSharedValue(0);
    const gazeX = useSharedValue(GAZE.rest[0]);
    const gazeY = useSharedValue(GAZE.rest[1]);
    const rockTilt = useSharedValue(0);
    const rockScale = useSharedValue(1);
    const rockOpacity = useSharedValue(1);
    const crack = useSharedValue(0);
    const glint = useSharedValue(0);
    const shards = useSharedValue(0);
    const gemClock = useSharedValue(0);
    const gemOpacity = useSharedValue(isReduceMotionEnabled ? 0 : 1);
    const twinkle = useSharedValue(motion.TWINKLE_FROM);
    const pips = useSharedValue(0);
    const count = useSharedValue(0);
    const xpPop = useSharedValue(isReduceMotionEnabled ? 1 : motion.XP_POP_FROM);
    const punch = useSharedValue(1);
    const shake = useSharedValue(0);
    const labelIn = useSharedValue(0);
    /** 0..1: the aiming hint gives way to the result. */
    const resultIn = useSharedValue(0);

    const rig: IRigValues = useMemo(() => ({
        skin, breath, coil, squash, rise, headX, tilt, reach, contact, blink, gazeX, gazeY,
    }), [skin, breath, coil, squash, rise, headX, tilt, reach, contact, blink, gazeX, gazeY]);
    const rock: IRockValues = useMemo(() => ({
        tilt: rockTilt, scale: rockScale, opacity: rockOpacity, crack, glint, shards,
    }), [rockTilt, rockScale, rockOpacity, crack, glint, shards]);

    const isJackpot = bonus.rarity === 'jackpot';
    const flights = useMemo(() => {
        const gemCount = getGemCount(bonus.bonusXp);
        return getGemFlights(
            gemCount + (isJackpot ? GEM_PILE.jackpotExtra : 0),
            gemCount,
            (motion.SECOND_VOLLEY_AT_MS - motion.BURST_AT_MS) / 1000,
        );
    }, [bonus.bonusXp, isJackpot]);
    const countDuration = motion.getCountDuration(bonus.bonusXp);

    const later = useCallback((delayMs: number, run: () => void) => {
        timeoutsRef.current.push(setTimeout(run, delayMs));
    }, []);

    // ---- Idle: breathing, the coil, blinks, glances and the rock's glint ---------------------
    useEffect(() => {
        if (isReduceMotionEnabled) {
            return undefined;
        }
        const sine = (duration: number) => ({ duration, easing: ease.inOutSine });
        breath.value = withRepeat(withTiming(1, sine(motion.BREATH_MS / 2)), -1, true);
        coil.value = withDelay(motion.COIL_OFFSET_MS, withRepeat(withTiming(1, sine(motion.COIL_MS / 2)), -1, true));

        blink.value = blinkLoop();

        const glance = (axis: 0 | 1) => {
            const move = { duration: motion.GLANCE_MOVE_MS, easing: ease.inOutCubic };
            return withRepeat(withSequence(
                withDelay(motion.GLANCE_EVERY_MS, withTiming(GAZE.rock[axis], move)),
                withDelay(motion.GLANCE_ROCK_HOLD_MS, withTiming(GAZE.viewer[axis], move)),
                withDelay(motion.GLANCE_VIEWER_HOLD_MS, withTiming(GAZE.rest[axis], move)),
            ), -1, false);
        };
        gazeX.value = glance(0);
        gazeY.value = glance(1);

        glint.value = withRepeat(withSequence(
            withDelay(motion.GLINT_EVERY_MS - motion.GLINT_MS, withTiming(1, { duration: motion.GLINT_MS / 2, easing: ease.outBack })),
            withTiming(0, { duration: motion.GLINT_MS / 2, easing: Easing.in(Easing.quad) }),
        ), -1, false);

        return () => {
            [breath, coil, blink, gazeX, gazeY, glint].forEach((value) => cancelAnimation(value));
        };
    }, [isReduceMotionEnabled, breath, coil, blink, gazeX, gazeY, glint]);

    useEffect(() => () => {
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
        cancelFeedbackRef.current?.();
    }, []);

    // ---- The reveal -------------------------------------------------------------------------
    /** The haptic and sound cue: on the burst frame itself. */
    const burstCue = useCallback(() => {
        cancelFeedbackRef.current = triggerGemBurstFeedback(bonus.rarity);
    }, [bonus.rarity]);

    /** The JS side of the reveal, kept off the burst frame so no React commit lands on it. */
    const reveal = useCallback(() => {
        onRevealed?.();
        setPhase('revealed');
    }, [onRevealed]);

    /** The finish once the number has landed, scaled to the rarity. */
    const flourish = useCallback(() => {
        setPhase('counted');
        blink.value = blinkLoop();
        labelIn.value = withTiming(1, { duration: motion.LABEL_MS, easing: ease.outQuad });
        if (bonus.rarity === 'common') {
            return;
        }
        punch.value = withSequence(
            withTiming(motion.PUNCH_SCALE, { duration: motion.PUNCH_MS / 2, easing: ease.outQuad }),
            withTiming(1, { duration: motion.PUNCH_MS / 2, easing: ease.inOutCubic }),
        );
        if (!isBigBonus(bonus.rarity)) {
            return;
        }
        twinkle.value = withTiming(motion.TWINKLE_TO, { duration: motion.TWINKLE_MS, easing: Easing.linear });
        if (isJackpot) {
            const beat = { duration: motion.SHAKE_BEAT_MS };
            shake.value = withSequence(
                withTiming(motion.SHAKE_DEG, beat),
                withTiming(-motion.SHAKE_DEG, beat),
                withTiming(motion.SHAKE_DEG, beat),
                withTiming(-motion.SHAKE_DEG, beat),
                withTiming(0, beat),
            );
        }
    }, [bonus.rarity, isJackpot, blink, labelIn, punch, twinkle, shake]);

    const revealWithoutMotion = () => {
        triggerTongueFlickFeedback(TAPS_TO_CATCH - 1);
        skin.value = withTiming(GOLD_SKIN, { duration: motion.REDUCED_COLOUR_MS, reduceMotion: ALWAYS });
        cancelAnimation(glint);
        glint.value = 0;
        rockOpacity.value = withTiming(0, { duration: motion.REDUCED_REVEAL_MS, reduceMotion: ALWAYS });
        gemClock.value = motion.GEM_CLOCK_MS / 1000;
        gemOpacity.value = withTiming(1, { duration: motion.REDUCED_REVEAL_MS, reduceMotion: ALWAYS });
        count.value = bonus.bonusXp;
        resultIn.value = withTiming(1, { duration: motion.REDUCED_REVEAL_MS, reduceMotion: ALWAYS });
        burstCue();
        reveal();
        setPhase('counted');
        labelIn.value = withTiming(1, { duration: motion.REDUCED_REVEAL_MS, reduceMotion: ALWAYS });
    };

    const strike = (tapIndex: number) => {
        // Eyes on the rock from the first tap on.
        cancelAnimation(gazeX);
        cancelAnimation(gazeY);
        gazeX.value = withTiming(GAZE.rock[0], { duration: motion.GLANCE_MOVE_MS });
        gazeY.value = withTiming(GAZE.rock[1], { duration: motion.GLANCE_MOVE_MS });

        // Anticipation: the head pulls back and the body squashes, then both snap through.
        headX.value = withSequence(
            withTiming(-motion.HEAD_PULL[tapIndex], { duration: motion.ANTICIPATION_MS, easing: ease.outQuad }),
            withTiming(motion.HEAD_SNAP, { duration: motion.STRIKE_MS / 2, easing: ease.outQuad }),
            withTiming(0, { duration: motion.RECOIL_MS, easing: ease.inOutCubic }),
        );
        squash.value = withSequence(
            withTiming(motion.SQUASH[tapIndex], { duration: motion.ANTICIPATION_MS, easing: ease.outQuad }),
            withSpring(0, { damping: 9, stiffness: 420, mass: 0.6 }),
        );
        pips.value = withTiming(tapIndex + 1, { duration: motion.COLOUR_MS });
    };

    const nearMiss = (tapIndex: number) => {
        strike(tapIndex);
        reach.value = withSequence(
            withDelay(motion.ANTICIPATION_MS, withTiming(TONGUE.reach[tapIndex], { duration: motion.STRIKE_MS, easing: ease.outBack })),
            withDelay(motion.STRIKE_HOLD_MS, withTiming(0, { duration: motion.RECOIL_MS, easing: ease.inCubic })),
        );
        skin.value = withDelay(motion.ANTICIPATION_MS, withTiming(tapIndex + 1, { duration: motion.COLOUR_MS, easing: ease.inOutCubic }));
        // The rock flinches away from the near miss and rocks back on its base.
        rockTilt.value = withDelay(motion.ROCK_WOBBLE_AT_MS, withSequence(
            withTiming(ROCK.wobble[tapIndex], { duration: motion.ROCK_WOBBLE_IN_MS, easing: ease.outQuad }),
            withSpring(0, { damping: 6, stiffness: 300 }),
        ));
        later(motion.ANTICIPATION_MS, () => triggerTongueFlickFeedback(tapIndex));
    };

    const theCatch = () => {
        const tapIndex = TAPS_TO_CATCH - 1;
        strike(tapIndex);
        reach.value = withSequence(
            withDelay(motion.ANTICIPATION_MS, withTiming(1, { duration: motion.CATCH_STRIKE_MS, easing: ease.outQuad })),
            withDelay(motion.HIT_STOP_MS, withTiming(0, { duration: motion.RECOIL_MS, easing: ease.inCubic })),
        );
        contact.value = withSequence(
            withDelay(motion.CONTACT_AT_MS, withTiming(1, { duration: motion.CONTACT_SQUASH_MS })),
            withTiming(0, { duration: motion.HIT_STOP_MS - motion.CONTACT_SQUASH_MS }),
        );

        // No blink over the catch: the eye stays on it until the count lands.
        cancelAnimation(blink);
        blink.value = withTiming(0, { duration: motion.BLINK_OPEN_MS });

        // Contact, hit-stop and crack; then the burst.
        cancelAnimation(glint);
        glint.value = 0;
        crack.value = withDelay(motion.CONTACT_AT_MS, withTiming(1, { duration: motion.CRACK_MS }));
        rockScale.value = withDelay(motion.CONTACT_AT_MS, withTiming(ROCK.hitStopScale, { duration: motion.HIT_STOP_MS }));
        rockOpacity.value = withDelay(motion.BURST_AT_MS, withTiming(0, { duration: 1 }));
        shards.value = withDelay(motion.BURST_AT_MS, withTiming(1, { duration: motion.SHARDS_MS, easing: ease.outQuad }));
        gemClock.value = withDelay(
            motion.BURST_AT_MS,
            withTiming(motion.GEM_CLOCK_MS / 1000, { duration: motion.GEM_CLOCK_MS, easing: Easing.linear }),
        );

        // The triumph: gold, a rise on the legs, the head up and the eyes after the gems.
        skin.value = withDelay(motion.BURST_AT_MS, withTiming(GOLD_SKIN, { duration: motion.GOLD_MS, easing: ease.inOutCubic }));
        rise.value = withDelay(motion.BURST_AT_MS, withSequence(
            withTiming(1, { duration: motion.RISE_MS, easing: ease.outQuad }),
            withSpring(motion.RISE_REST, { damping: 8, stiffness: 160 }),
        ));
        tilt.value = withDelay(motion.BURST_AT_MS, withSequence(
            withTiming(motion.HEAD_TILT_DEG, { duration: motion.RISE_MS, easing: ease.outQuad }),
            withDelay(motion.LOOK_UP_HOLD_MS, withTiming(0, { duration: motion.LOOK_BACK_MS, easing: ease.inOutCubic })),
        ));
        const lookUpThenBack = (axis: 0 | 1) => withDelay(motion.BURST_AT_MS, withSequence(
            withTiming(GAZE.up[axis], { duration: motion.LOOK_UP_MS, easing: ease.outQuad }),
            withDelay(motion.LOOK_UP_HOLD_MS, withTiming(GAZE.viewer[axis], { duration: motion.LOOK_BACK_MS, easing: ease.inOutCubic })),
        ));
        gazeX.value = lookUpThenBack(0);
        gazeY.value = lookUpThenBack(1);

        // The count climbs as the gems pass their apex.
        count.value = withDelay(motion.COUNT_AT_MS, withTiming(bonus.bonusXp, { duration: countDuration, easing: ease.outCubic }));
        xpPop.value = withDelay(motion.COUNT_AT_MS, withSpring(1, { damping: 12, stiffness: 220 }));

        resultIn.value = withDelay(motion.BURST_AT_MS, withTiming(1, { duration: motion.RESULT_SWAP_MS, easing: ease.inOutCubic }));

        later(motion.CONTACT_AT_MS, () => triggerTongueFlickFeedback(tapIndex));
        later(motion.BURST_AT_MS, burstCue);
        later(motion.BURST_AT_MS + motion.REVEAL_JS_AFTER_BURST_MS, reveal);
        later(motion.COUNT_AT_MS + countDuration, flourish);
    };

    const onPress = () => {
        const tapIndex = tapsRef.current;
        if (tapIndex >= TAPS_TO_CATCH) {
            return;
        }
        tapsRef.current = tapIndex + 1;
        setTaps(tapIndex + 1);
        const isCatch = tapIndex === TAPS_TO_CATCH - 1;

        if (isReduceMotionEnabled) {
            pips.value = tapIndex + 1;
            if (isCatch) {
                revealWithoutMotion();
            } else {
                triggerTongueFlickFeedback(tapIndex);
                skin.value = withTiming(tapIndex + 1, { duration: motion.REDUCED_COLOUR_MS, reduceMotion: ALWAYS });
            }
            return;
        }
        if (isCatch) {
            theCatch();
        } else {
            nearMiss(tapIndex);
        }
    };

    // ---- The result area: pips and hint, then the count ---------------------------------------
    const [xpPrefix, xpSuffix] = translate('pages.celebration.bonus.xp', { xp: XP_TOKEN }).split(XP_TOKEN);
    // `text` is not in TextInput's typed props, but it is how a native text value is set
    // without a JS render on every frame; hence the cast.
    const countProps = useAnimatedProps(() => ({
        text: `${xpPrefix}${Math.round(count.value)}${xpSuffix ?? ''}`,
    } as any));
    const xpStyle = useAnimatedStyle(() => ({
        // Hidden until the count starts, then in with the pop: never a "+0" waiting on screen.
        opacity: Math.min(1, Math.max(0, ((xpPop.value - motion.XP_POP_FROM) / (1 - motion.XP_POP_FROM)) * 2)),
        transform: [{ scale: xpPop.value * punch.value }, { rotate: `${shake.value}deg` }],
    }));
    const aimingStyle = useAnimatedStyle(() => ({ opacity: 1 - resultIn.value }));
    const resultStyle = useAnimatedStyle(() => ({ opacity: resultIn.value }));
    const labelStyle = useAnimatedStyle(() => ({
        opacity: labelIn.value,
        transform: [{ translateY: motion.LABEL_RISE * (1 - labelIn.value) }],
    }));

    const skinsForPips = palette.skins.slice(1);
    let hint: string;
    if (taps === 0) {
        hint = translate('pages.celebration.bonus.hintTap');
    } else if (taps >= TAPS_TO_CATCH - 1) {
        hint = translate('pages.celebration.bonus.hintOneMore');
    } else {
        hint = translate('pages.celebration.bonus.hintKeepGoing');
    }
    const resultColor = isBigBonus(bonus.rarity) ? palette.resultGold : colors.textWhite;
    const finalXp = translate('pages.celebration.bonus.xp', { xp: bonus.bonusXp });

    return (
        <View style={styles.container}>
            <Pressable
                onPress={onPress}
                disabled={phase !== 'aiming'}
                accessibilityRole="button"
                accessibilityLabel={translate('pages.celebration.bonus.accessibilityLabel')}
                // Three activations reveal the bonus; the hint and the tap count say how far along it is.
                accessibilityHint={hint}
                accessibilityValue={{ min: 0, max: TAPS_TO_CATCH, now: taps }}
                // Once revealed the scene is decoration; the result below carries the announcement.
                accessibilityElementsHidden={phase !== 'aiming'}
                importantForAccessibility={phase === 'aiming' ? 'auto' : 'no-hide-descendants'}
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
                    <Hill palette={palette} />
                    <ChameleonLimbs limbs={LIMBS_FAR} width={LIMB_WIDTH_FAR} colors={palette.shades} values={rig} />
                    <Branch palette={palette} />
                    <ChameleonBody palette={palette} values={rig} />
                    <ChameleonLimbs limbs={LIMBS_NEAR} width={LIMB_WIDTH_NEAR} colors={palette.skins} values={rig} />
                    <Rock palette={palette} values={rock} />
                    <Shards palette={palette} progress={shards} />
                    <BurstRing color={colors.accent} progress={shards} />
                    <Gems
                        flights={flights}
                        colors={palette.gems}
                        highlight={palette.eyeWhite}
                        clock={gemClock}
                        opacity={gemOpacity}
                        twinkle={twinkle}
                    />
                </View>
            </Pressable>
            {/*
              Both halves of the result area are mounted from the start and cross-faded on the UI
              thread, so the burst frame never waits on views being created (a TextInput is costly
              to mount on Android, and doing it at the burst dropped frames there).
            */}
            <View style={styles.result}>
                <Animated.View
                    style={[styles.aiming, aimingStyle]}
                    accessibilityElementsHidden={phase !== 'aiming'}
                    importantForAccessibility={phase === 'aiming' ? 'auto' : 'no-hide-descendants'}
                >
                    {/* People tap the line that tells them to tap, so it is part of the target too. Not a
                        second button for a screen reader: the scene above is that button. */}
                    <Pressable onPress={onPress} disabled={phase !== 'aiming'} accessible={false} style={styles.aiming}>
                        <View style={styles.pips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                            {skinsForPips.map((pipColor, index) => (
                                <Pip key={pipColor} color={pipColor} index={index} progress={pips} />
                            ))}
                        </View>
                        <Text style={[styles.hint, { color: colors.textWhite }]} accessibilityLiveRegion="polite">{hint}</Text>
                    </Pressable>
                </Animated.View>
                <Animated.View
                    style={[styles.reveal, resultStyle]}
                    pointerEvents="none"
                    accessible={phase !== 'aiming'}
                    accessibilityLiveRegion="polite"
                    accessibilityElementsHidden={phase === 'aiming'}
                    importantForAccessibility={phase === 'aiming' ? 'no-hide-descendants' : 'yes'}
                    accessibilityLabel={phase === 'aiming' ? undefined : translate('pages.celebration.bonus.revealAccessibility', {
                        rarity: translate(`pages.celebration.bonus.rarity.${bonus.rarity}`),
                        xp: bonus.bonusXp,
                    })}
                >
                    <View style={styles.xpRow}>
                        <Animated.View style={xpStyle}>
                            {phase === 'counted' ? (
                                <Text style={[styles.xp, { color: resultColor }]}>{finalXp}</Text>
                            ) : (
                                <AnimatedTextInput
                                    animatedProps={countProps}
                                    defaultValue={`${xpPrefix}0${xpSuffix ?? ''}`}
                                    editable={false}
                                    caretHidden
                                    underlineColorAndroid="transparent"
                                    importantForAccessibility="no"
                                    style={[styles.xp, styles.xpCounting, { color: resultColor }]}
                                />
                            )}
                        </Animated.View>
                    </View>
                    {phase === 'aiming' ? null : (
                        <Animated.View style={labelStyle}>
                            <Text style={[styles.rarity, { color: resultColor }]}>
                                {translate(`pages.celebration.bonus.rarity.${bonus.rarity}`)}
                            </Text>
                        </Animated.View>
                    )}
                </Animated.View>
            </View>
        </View>
    );
};

/** One of the three progress pips; it fills as its tap's colour blends in. */
const Pip = ({ color, index, progress }: { color: string; index: number; progress: SharedValue<number> }) => {
    const fillStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, Math.max(0, progress.value - index)),
    }));
    return (
        <View style={[styles.pip, { borderColor: color }]}>
            <Animated.View style={[styles.pipFill, { backgroundColor: color }, fillStyle]} />
        </View>
    );
};

const PIP_SIZE = 12;
const XP_FONT_SIZE = 48;
const XP_LINE_HEIGHT = 54;

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    scene: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
    },
    // Full width, so the overlaid result is never as narrow as whatever hint is showing.
    result: {
        alignSelf: 'stretch',
        alignItems: 'center',
        minHeight: 96,
        justifyContent: 'center',
    },
    aiming: {
        alignItems: 'center',
    },
    // Laid over the aiming half, so the swap never changes the area's height.
    reveal: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    xpRow: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    xp: {
        fontSize: XP_FONT_SIZE,
        lineHeight: XP_LINE_HEIGHT,
        fontWeight: '800',
        letterSpacing: -1,
        textAlign: 'center',
    },
    // A TextInput carries platform padding and font padding a Text does not; without these the
    // number would jump when the count hands over to the final Text.
    xpCounting: {
        padding: 0,
        margin: 0,
        includeFontPadding: false,
        minWidth: XP_FONT_SIZE * 4,
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
        width: PIP_SIZE,
        height: PIP_SIZE,
        borderRadius: PIP_SIZE / 2,
        borderWidth: 2,
        overflow: 'hidden',
    },
    pipFill: {
        flex: 1,
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
