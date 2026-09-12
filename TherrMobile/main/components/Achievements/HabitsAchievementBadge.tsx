import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import Color from 'color';
import ChameleonFace from '../Chameleon/ChameleonFace';
import { FACE_ASPECT } from '../Chameleon/geometry';
import { ITherrThemeColors } from '../../styles/themes';

/**
 * Card art for a Friends with Habits achievement.
 *
 * The Therr achievement cards are Lottie files drawn for Therr's classes
 * (explorer, socialite, thinker…), and the Habits classes were borrowing them —
 * "Habit Builder" wore the explorer's compass. This draws a card per Habits class
 * from three things the app already has: a FontAwesome glyph for what the class
 * rewards, a colour from the active theme, and the chameleon, peeking over the
 * bottom edge the way it does on the landing page.
 *
 * Nothing here is a baked asset, so every card follows the theme, and an
 * achievement class added to `therr-js-utilities` needs one line in `CLASS_ART`
 * rather than a new animation.
 */

type IInk = 'light' | 'dark';

interface IClassArt {
    /** FontAwesome 5 (free, solid) glyph name. */
    icon: string;
    /** Which theme colour the card is painted in. */
    color: keyof ITherrThemeColors;
    /** Whether the glyph reads better light or dark on that colour. */
    ink: IInk;
}

/**
 * Exported for the test, which holds every class the Habits brand can earn
 * (`achievementClassesByBrand[HABITS]`) to an entry here.
 */
export const CLASS_ART: { [achievementClass: string]: IClassArt } = {
    accountability: { icon: 'handshake', color: 'brand', ink: 'light' },
    cleanBreak: { icon: 'shield-alt', color: 'accentBlue', ink: 'light' },
    consistency: { icon: 'calendar-check', color: 'accentTeal', ink: 'light' },
    habitBuilder: { icon: 'seedling', color: 'accentLime', ink: 'light' },
    pactPioneer: { icon: 'flag', color: 'accentPurple', ink: 'light' },
    resilience: { icon: 'mountain', color: 'brandDark', ink: 'light' },
    socialEnergizer: { icon: 'bolt', color: 'accentRed', ink: 'light' },
    socialite: { icon: 'users', color: 'accentAlt', ink: 'light' },
    treasureBuilder: { icon: 'gem', color: 'accentYellow', ink: 'dark' },
    weeklyChampion: { icon: 'trophy', color: 'accent', ink: 'light' },
};

export const FALLBACK_ART: IClassArt = { icon: 'star', color: 'brand', ink: 'light' };

export const getClassArt = (achievementClass: string): IClassArt => CLASS_ART[achievementClass] || FALLBACK_ART;

/** How much of the card's width the peeking chameleon spans. */
const FACE_WIDTH_RATIO = 0.62;
/** How much of the face hangs below the card's bottom edge (the mouth, not the eyes). */
const FACE_HIDDEN_RATIO = 0.3;
/** An unearned card is a silhouette of the one you are working toward. */
const UNEARNED_OPACITY = 0.45;

export interface IHabitsAchievementBadgeProps {
    achievementClass: string;
    isComplete: boolean;
    /** Glyph size in dp. The card itself fills its parent. */
    iconSize?: number;
    theme: {
        colors: ITherrThemeColors;
    };
    testID?: string;
}

const HabitsAchievementBadge = ({
    achievementClass,
    isComplete,
    iconSize = 28,
    theme,
    testID,
}: IHabitsAchievementBadgeProps) => {
    const { colors } = theme;
    const art = getClassArt(achievementClass);
    const ground = colors[art.color] as string;
    const groundDeep = Color(ground).darken(0.28).hex();
    const ink = art.ink === 'dark' ? colors.brandingBlack : colors.brandingWhite;
    // The face is placed from the card's measured size so the same fraction of it
    // peeks over the edge on a 72dp tile and a 40%-wide claim card alike.
    const [face, setFace] = useState<{ width: number; height: number } | null>(null);

    const onLayout = (event: LayoutChangeEvent) => {
        const { width } = event.nativeEvent.layout;
        const faceWidth = width * FACE_WIDTH_RATIO;
        setFace({ width: faceWidth, height: faceWidth * FACE_ASPECT });
    };

    return (
        <View
            style={[styles.card, isComplete ? styles.earned : styles.unearned]}
            onLayout={onLayout}
            testID={testID || `habits-achievement-badge-${achievementClass}`}
        >
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id={`badge-ground-${achievementClass}`} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={ground} />
                        <Stop offset="1" stopColor={groundDeep} />
                    </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#badge-ground-${achievementClass})`} />
            </Svg>
            <View style={styles.glyph}>
                <FontAwesome5Icon name={art.icon} size={iconSize} color={ink} solid />
            </View>
            {face && (
                <View
                    style={[
                        styles.face,
                        { width: face.width, height: face.height, bottom: -face.height * FACE_HIDDEN_RATIO },
                    ]}
                    pointerEvents="none"
                >
                    <ChameleonFace skin={colors.brand} outline={colors.brandingWhite} theme={theme} />
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
    earned: {
        opacity: 1,
    },
    unearned: {
        opacity: UNEARNED_OPACITY,
    },
    glyph: {
        // Sits in the upper half so the chameleon has the lower edge to itself.
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: '22%',
    },
    face: {
        position: 'absolute',
        alignSelf: 'center',
    },
});

export default HabitsAchievementBadge;
