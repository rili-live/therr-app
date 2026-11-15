import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import ChameleonFace from '../Chameleon/ChameleonFace';
import { FACE_ASPECT, getOutlinedFaceBox } from '../Chameleon/geometry';
import { ITherrThemeColors } from '../../styles/themes';
import { therrFontFamily } from '../../styles/font';
import { getBadgeStateColors, getBadgeTone } from '../../styles/achievements/badgePalette';
import { toRomanNumeral } from '../../utilities/achievementCollection';

/**
 * Card art for a Friends with Habits achievement.
 *
 * The Therr achievement cards are Lottie files drawn for Therr's classes
 * (explorer, socialite, thinker…), and the Habits classes were borrowing them —
 * "Habit Builder" wore the explorer's compass. This draws a card per Habits badge
 * from things the app already has: a FontAwesome glyph for what the ladder
 * rewards, a hue for the class, and the chameleon, peeking over the bottom edge
 * the way it does on the landing page.
 *
 * Nothing here is a baked asset, so every card follows the theme, and an
 * achievement class added to `therr-js-utilities` needs one line in `CLASS_ART`
 * (and a hue in `styles/achievements/badgePalette`) rather than a new animation.
 *
 * A card has three states, and they differ in more than strength of colour, so
 * none of them depends on the reader comparing one card's opacity with another's:
 *
 *  - earned      — the class colour at full strength, lit, with the level it marks;
 *  - in progress — the same card drained to a tint, the chameleon watching;
 *  - locked      — no hue, no chameleon, a padlock where it would sit.
 */

interface IClassArt {
    /** FontAwesome 5 (free, solid) glyph name. */
    icon: string;
    /**
     * Glyphs for a class's secondary ladders, by config `tier`. A class can hold
     * more than one ladder ("complete pacts" and "help a partner complete theirs"),
     * and one glyph for both made them indistinguishable in a grid.
     */
    tracks?: { [track: string]: string };
}

/**
 * Exported for the test, which holds every class the Habits brand can earn
 * (`achievementClassesByBrand[HABITS]`) to an entry here.
 */
export const CLASS_ART: { [achievementClass: string]: IClassArt } = {
    accountability: { icon: 'handshake', tracks: { '1_2': 'hands-helping' } },
    cleanBreak: { icon: 'shield-alt' },
    consistency: { icon: 'calendar-check', tracks: { '1_2': 'layer-group' } },
    dailyStreak: {
        icon: 'fire',
        tracks: {
            '1_2': 'calendar-week',
            '1_3': 'calendar-alt',
            '1_4': 'redo-alt',
            '1_5': 'snowflake',
        },
    },
    habitBuilder: { icon: 'seedling' },
    pactPioneer: { icon: 'flag', tracks: { '1_2': 'paper-plane' } },
    resilience: { icon: 'mountain', tracks: { '1_2': 'wind' } },
    socialEnergizer: { icon: 'bolt', tracks: { '1_2': 'glass-cheers' } },
    socialite: { icon: 'users', tracks: { '1_1': 'user-plus', '1_2': 'user-friends' } },
    treasureBuilder: { icon: 'gem', tracks: { '1_2': 'piggy-bank' } },
    weeklyChampion: { icon: 'trophy', tracks: { '1_1': 'award', '1_2': 'medal', '1_3': 'crown' } },
};

export const FALLBACK_ART: IClassArt = { icon: 'star' };

export const getClassArt = (achievementClass: string): IClassArt => CLASS_ART[achievementClass] || FALLBACK_ART;

/** The glyph for one ladder of a class; the class's own glyph when the ladder has none. */
export const getBadgeGlyph = (achievementClass: string, track?: string): string => {
    const art = getClassArt(achievementClass);
    return (track && art.tracks?.[track]) || art.icon;
};

export type HabitsBadgeState = 'earned' | 'inProgress' | 'locked';

/**
 * The card is drawn on a 72 × 92 canvas — the size of the original list tile —
 * and scaled from there, so the art is the same drawing at every size.
 */
const CANVAS_WIDTH = 72;
const CANVAS_HEIGHT = 92;
/** height / width. Size a container with this so the art is never letterboxed. */
export const BADGE_ASPECT = CANVAS_HEIGHT / CANVAS_WIDTH;

/** Corner radius as a share of the card's width (12dp on the 72dp tile). */
const CORNER_RATIO = 12 / CANVAS_WIDTH;
const CORNER_RADIUS = CANVAS_WIDTH * CORNER_RATIO;
/** How much of the card's width the peeking chameleon spans. */
const FACE_WIDTH_RATIO = 0.62;
/** How much of the face hangs below the card's bottom edge (the mouth, not the eyes). */
const FACE_HIDDEN_RATIO = 0.3;
/** Logo-unit width of the white sticker outline round the face. */
const FACE_OUTLINE_WIDTH = 36;
const FACE_OUTLINE = getOutlinedFaceBox(FACE_OUTLINE_WIDTH);
/** Glyph size as a share of the card's width. */
const GLYPH_RATIO = 0.37;
/** Below this width the level numeral would be too small to read, so it is left off. */
const MIN_WIDTH_FOR_LEVEL = 56;

/** A four-point sparkle centred on (x, y), reaching `r` units along each axis. */
const sparkle = (x: number, y: number, r: number) => `M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} `
    + `Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z`;

const SPARKLES = [sparkle(57.5, 18, 4.6), sparkle(13.5, 48, 3.1)];
const CAPSTONE_SPARKLE = sparkle(60, 43, 2.4);
/** The lit band that crosses an earned card from its top-left corner. */
const SHEEN_PATH = `M 0 0 H 44 L 12 ${CANVAS_HEIGHT} H 0 Z`;

/** Ink-on-colour scrim behind an earned card's numeral. Not a theme colour: it darkens whatever hue it sits on. */
const LEVEL_SCRIM = 'rgba(0, 0, 0, 0.24)';

export interface IHabitsAchievementBadgeProps {
    achievementClass: string;
    /** Which of the class's ladders the badge is on (the config `tier`). */
    track?: string;
    /**
     * Where the user stands on it. `isComplete` is the two-state form older callers
     * pass; `state` wins when both are given.
     */
    state?: HabitsBadgeState;
    isComplete?: boolean;
    /** 1-based rung on the ladder. Drawn as a Roman numeral; omit for none. */
    level?: number;
    /** The top rung of a ladder — gets a second keyline and an inverted numeral. */
    isCapstone?: boolean;
    /**
     * Card width in dp. With it the card sizes itself (height follows `BADGE_ASPECT`)
     * and is complete on first render. Without it the card fills its parent and
     * places the chameleon once it has been measured.
     */
    width?: number;
    /** Glyph size in dp. Defaults to a share of the card's width. */
    iconSize?: number;
    theme: {
        colors: ITherrThemeColors;
    };
    testID?: string;
}

const HabitsAchievementBadge = ({
    achievementClass,
    track,
    state,
    isComplete,
    level,
    isCapstone = false,
    width,
    iconSize,
    theme,
    testID,
}: IHabitsAchievementBadgeProps) => {
    const { colors } = theme;
    const resolvedState: HabitsBadgeState = state || (isComplete ? 'earned' : 'inProgress');
    const isEarned = resolvedState === 'earned';
    const isLocked = resolvedState === 'locked';
    const tone = getBadgeTone(achievementClass, colors);
    const palette = getBadgeStateColors(resolvedState, tone, colors);
    const glyph = getBadgeGlyph(achievementClass, track);

    // The face and the glyph are placed from the card's width. A caller that knows it
    // passes it; one that does not gets a measured pass, as before.
    const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
    const cardWidth = width ?? measuredWidth;

    const onLayout = (event: LayoutChangeEvent) => {
        if (width === undefined) {
            setMeasuredWidth(event.nativeEvent.layout.width);
        }
    };

    const faceWidth = cardWidth ? cardWidth * FACE_WIDTH_RATIO : 0;
    const faceHeight = faceWidth * FACE_ASPECT;
    // The frame is the face plus room for its outline on every side. Without that room the
    // outline was cut off square where it rounds each eye.
    const faceBleedX = faceWidth * FACE_OUTLINE.bleedX;
    const faceBleedY = faceHeight * FACE_OUTLINE.bleedY;
    const glyphSize = iconSize ?? (cardWidth ? Math.round(cardWidth * GLYPH_RATIO) : 28);
    const cornerRadius = cardWidth ? cardWidth * CORNER_RATIO : 12;
    const unit = cardWidth ? cardWidth / CANVAS_WIDTH : 1;
    const showLevel = !!level && !isLocked && !!cardWidth && cardWidth >= MIN_WIDTH_FOR_LEVEL;
    // The numeral's plate: a scrim on an earned card, solid white on a capstone, and the
    // glyph's own ink on a card still being worked toward.
    let levelColors = { plate: palette.ink, numeral: palette.groundFrom };
    if (isEarned) {
        levelColors = isCapstone
            ? { plate: colors.brandingWhite, numeral: tone.to }
            : { plate: LEVEL_SCRIM, numeral: colors.brandingWhite };
    }
    // Unique per variant: on the web renderer gradient ids are document-wide.
    const idSuffix = `${achievementClass}-${resolvedState}`;

    return (
        <View
            style={[
                styles.card,
                { borderRadius: cornerRadius },
                width !== undefined && { width, height: width * BADGE_ASPECT },
            ]}
            onLayout={onLayout}
            testID={testID || `habits-achievement-badge-${achievementClass}`}
        >
            <Svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                preserveAspectRatio="none"
                style={StyleSheet.absoluteFill}
            >
                <Defs>
                    <LinearGradient id={`badge-ground-${idSuffix}`} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={palette.groundFrom} />
                        <Stop offset="1" stopColor={palette.groundTo} />
                    </LinearGradient>
                    <RadialGradient id={`badge-glow-${idSuffix}`} cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor={palette.glow} stopOpacity={palette.glowOpacity} />
                        <Stop offset="1" stopColor={palette.glow} stopOpacity={0} />
                    </RadialGradient>
                    <LinearGradient id={`badge-floor-${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={tone.to} stopOpacity={0} />
                        <Stop offset="1" stopColor={tone.to} stopOpacity={0.55} />
                    </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={`url(#badge-ground-${idSuffix})`} />
                {!isLocked && (
                    // A pool of light behind the glyph, so it sits on the card rather than in it.
                    <Circle cx={CANVAS_WIDTH / 2} cy={33} r={31} fill={`url(#badge-glow-${idSuffix})`} />
                )}
                {isEarned && (
                    <>
                        <Path d={SHEEN_PATH} fill={colors.brandingWhite} opacity={0.07} />
                        <Rect x="0" y={54} width={CANVAS_WIDTH} height={CANVAS_HEIGHT - 54} fill={`url(#badge-floor-${idSuffix})`} />
                        {SPARKLES.map((d) => (
                            <Path key={d} d={d} fill={colors.brandingWhite} opacity={0.6} />
                        ))}
                        {isCapstone && <Path d={CAPSTONE_SPARKLE} fill={colors.brandingWhite} opacity={0.6} />}
                    </>
                )}
                <Rect
                    x={1}
                    y={1}
                    width={CANVAS_WIDTH - 2}
                    height={CANVAS_HEIGHT - 2}
                    rx={CORNER_RADIUS - 1}
                    fill="none"
                    stroke={palette.keyline}
                    strokeOpacity={isEarned && isCapstone ? 0.85 : palette.keylineOpacity}
                    strokeWidth={isEarned && isCapstone ? 1.6 : 1.2}
                />
                {isEarned && isCapstone && (
                    <Rect
                        x={4}
                        y={4}
                        width={CANVAS_WIDTH - 8}
                        height={CANVAS_HEIGHT - 8}
                        rx={CORNER_RADIUS - 4}
                        fill="none"
                        stroke={palette.keyline}
                        strokeOpacity={0.45}
                        strokeWidth={0.7}
                    />
                )}
            </Svg>
            <View style={styles.glyph}>
                <FontAwesome5Icon
                    name={glyph}
                    size={glyphSize}
                    color={palette.ink}
                    solid
                    style={isEarned ? styles.glyphShadow : undefined}
                />
            </View>
            {showLevel && (
                <View
                    style={[
                        styles.level,
                        {
                            top: 5 * unit,
                            left: 5 * unit,
                            minWidth: 15 * unit,
                            height: 13 * unit,
                            paddingHorizontal: 3.5 * unit,
                            borderRadius: 6.5 * unit,
                            backgroundColor: levelColors.plate,
                        },
                    ]}
                    testID="habits-badge-level"
                >
                    <Text
                        allowFontScaling={false}
                        style={[styles.levelText, { fontSize: 8.2 * unit, lineHeight: 13 * unit, color: levelColors.numeral }]}
                    >
                        {toRomanNumeral(level)}
                    </Text>
                </View>
            )}
            {!!cardWidth && !isLocked && (
                <View
                    style={[
                        styles.face,
                        {
                            width: faceWidth + faceBleedX * 2,
                            height: faceHeight + faceBleedY * 2,
                            bottom: -faceHeight * FACE_HIDDEN_RATIO - faceBleedY,
                        },
                    ]}
                    pointerEvents="none"
                >
                    <ChameleonFace
                        skin={colors.brand}
                        outline={colors.brandingWhite}
                        outlineWidth={FACE_OUTLINE_WIDTH}
                        theme={theme}
                    />
                </View>
            )}
            {!!cardWidth && isLocked && (
                <View
                    style={[
                        styles.lock,
                        {
                            bottom: 9 * unit,
                            width: 20 * unit,
                            height: 20 * unit,
                            borderRadius: 10 * unit,
                            backgroundColor: palette.ink,
                        },
                    ]}
                    pointerEvents="none"
                    testID="habits-badge-lock"
                >
                    <FontAwesome5Icon name="lock" size={9 * unit} color={palette.groundFrom} solid />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    glyph: {
        // Sits in the upper half so the chameleon has the lower edge to itself.
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: '22%',
    },
    glyphShadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.18)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    level: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    levelText: {
        fontFamily: therrFontFamily,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.2,
        includeFontPadding: false,
    },
    face: {
        position: 'absolute',
        alignSelf: 'center',
    },
    lock: {
        position: 'absolute',
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default HabitsAchievementBadge;
