import React from 'react';
import { Pressable, Text, View } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import AchievementArt from './AchievementArt';
import { IAchievementBadge } from '../../utilities/achievementCollection';
import { GRID_GAP, GRID_PANEL_PADDING } from '../../styles/achievements';
import { space } from '../../styles/layouts/spacing';

/** Columns in the badge grid. Three keeps a two-line title legible on a 360dp phone. */
export const getBadgeGridColumns = (windowWidth: number) => {
    if (windowWidth >= 840) return 6;
    if (windowWidth >= 600) return 5;
    if (windowWidth >= 480) return 4;
    return 3;
};

/** Screen edge to the first card: the panel's margin plus its own padding. */
const GRID_GUTTER = space.lg + GRID_PANEL_PADDING;
const MIN_BADGE_WIDTH = 64;
const MAX_BADGE_WIDTH = 96;

/**
 * Badge width for a grid of `columns` across `windowWidth`. The card takes about
 * three quarters of its cell, which leaves the title room to wrap wider than the
 * art without the cards touching.
 */
export const getBadgeGridCardWidth = (windowWidth: number, columns: number) => {
    const cellWidth = (windowWidth - GRID_GUTTER * 2 - GRID_GAP * (columns - 1)) / columns;
    return Math.round(Math.max(MIN_BADGE_WIDTH, Math.min(MAX_BADGE_WIDTH, cellWidth * 0.76)));
};

interface IAchievementBadgeCellProps {
    badge: IAchievementBadge;
    cardWidth: number;
    onPress?: (badge: IAchievementBadge) => void;
    /** Short status read out with the title: "Earned", "In progress", "Locked", "Reward ready". */
    stateLabel: string;
    progressLabel: string;
    claimLabel: string;
    themeAchievements: any;
}

/**
 * One badge in the grid: the card, its name, and — only where there is something to
 * say — what state it is in. An earned badge carries no caption at all; its colour is
 * the caption. The description and reward live on the detail screen a tap away.
 */
const AchievementBadgeCell = ({
    badge,
    cardWidth,
    onPress,
    stateLabel,
    progressLabel,
    claimLabel,
    themeAchievements,
}: IAchievementBadgeCellProps) => {
    const { styles, colors } = themeAchievements;
    const isLocked = badge.state === 'locked';
    const isInProgress = badge.state === 'inProgress';
    const isClaimable = badge.state === 'claimable';
    const a11yLabel = [badge.config.title, stateLabel, isInProgress ? progressLabel : '']
        .filter(Boolean)
        .join('. ');

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            disabled={!onPress}
            onPress={() => onPress?.(badge)}
            style={({ pressed }) => [styles.badgeCell, pressed && styles.badgeCellPressed]}
            testID={`achievement-badge-cell-${badge.key}`}
        >
            <View style={styles.badgeCellArt}>
                <AchievementArt
                    achievementClass={badge.achievementClass}
                    track={badge.track}
                    state={badge.state}
                    level={badge.level}
                    isCapstone={badge.isCapstone}
                    width={cardWidth}
                    theme={themeAchievements}
                />
                {isClaimable && (
                    <View style={styles.badgeCellGift} testID="achievement-badge-cell-gift">
                        <FontAwesome5Icon name="gift" size={10} color={colors.onAccent} solid />
                    </View>
                )}
            </View>
            <Text
                style={[styles.badgeCellTitle, isLocked && styles.badgeCellTitleLocked]}
                numberOfLines={2}
            >
                {badge.config.title}
            </Text>
            {isInProgress && (
                <View style={[styles.badgeCellProgress, { width: cardWidth }]}>
                    <View style={styles.badgeCellProgressTrack}>
                        <View style={[styles.progressBarFill, { width: `${badge.progressRatio * 100}%` }]} />
                    </View>
                    <Text style={styles.badgeCellMeta} numberOfLines={1}>{progressLabel}</Text>
                </View>
            )}
            {isClaimable && (
                <Text style={[styles.badgeCellMeta, styles.badgeCellMetaClaim]} numberOfLines={1}>{claimLabel}</Text>
            )}
        </Pressable>
    );
};

export default React.memo(AchievementBadgeCell);
