import React from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import AchievementArt from './AchievementArt';
import { IAchievementBadge, toAchievementBadge } from '../../utilities/achievementCollection';
import { formatRewardAmount } from '../../utilities/achievements';

/** Badge width in a row. Small enough to leave the text the row, large enough to show the level. */
export const TILE_BADGE_WIDTH = 56;

interface IAchievementTileProps {
    /** The row to draw. Pass `badge` when the caller already holds one; otherwise the backend row. */
    badge?: IAchievementBadge | null;
    userAchievement?: any;
    /** Localized class name. Falls back to the class id split into words. */
    classLabel?: string;
    claimText: string;
    completedText: string;
    handleClaim: () => void;
    isClaiming: boolean;
    onPressAchievement: () => void;
    progressText: (params: { count: number; total: number }) => string;
    themeAchievements: any;
}

/**
 * One achievement as a row: the two lists at the top of the Achievements screen
 * ("ready to claim" and "up next"), where there are few enough items that each can
 * afford its description and a full-width progress meter. Everything else on the
 * screen is the badge grid (`AchievementBadgeCell`).
 */
const AchievementTile = ({
    badge: badgeProp,
    userAchievement,
    classLabel,
    claimText,
    completedText,
    handleClaim,
    isClaiming,
    onPressAchievement,
    progressText,
    themeAchievements,
}: IAchievementTileProps) => {
    const badge = badgeProp || toAchievementBadge(userAchievement);

    // An achievement this build's config does not know (the backend is ahead of the
    // app). Indexing the config for it used to throw and take the whole screen down.
    if (!badge) {
        return null;
    }

    const { styles, colors } = themeAchievements;
    const { config } = badge;
    const isClaimable = badge.state === 'claimable';
    const isComplete = isClaimable || badge.state === 'earned';
    const progressLabel = progressText({ count: badge.progressCount, total: config.countToComplete });
    const reward = formatRewardAmount(isClaimable ? badge.userAchievement?.unclaimedRewardPts : config.pointReward);
    const overline = classLabel || badge.achievementClass.replace(/([A-Z])/g, ' $1');

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${config.title}. ${isComplete ? completedText : progressLabel}`}
            style={({ pressed }) => [
                styles.achievementTile,
                isClaimable && styles.achievementTileClaimable,
                pressed && styles.achievementTilePressed,
            ]}
            onPress={onPressAchievement}
        >
            <AchievementArt
                achievementClass={badge.achievementClass}
                track={badge.track}
                state={badge.state}
                level={badge.level}
                isCapstone={badge.isCapstone}
                width={TILE_BADGE_WIDTH}
                theme={themeAchievements}
            />
            <View style={styles.tileTextContainer}>
                <View style={styles.tileOverlineRow}>
                    <Text style={styles.achievementClassLabel} numberOfLines={1}>
                        {overline}
                    </Text>
                    {!!reward && (
                        <View style={styles.rewardHint}>
                            <FontAwesome5Icon name="coins" size={10} color={colors.accent} solid />
                            <Text style={styles.rewardHintText}>{isClaimable ? `+${reward}` : reward}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.tileTitle} numberOfLines={2}>
                    {config.title}
                </Text>
                <Text style={styles.achievementDescription} numberOfLines={2}>
                    {config.description}
                </Text>
                {!isComplete && (
                    <View style={styles.progressRow}>
                        <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${badge.progressRatio * 100}%` }]} />
                        </View>
                        <Text style={styles.progressLabel}>
                            {progressLabel}
                        </Text>
                    </View>
                )}
                {badge.state === 'earned' && (
                    <View style={styles.completedChip}>
                        <FontAwesome5Icon name="check" size={10} color={colors.alertSuccess} solid />
                        <Text style={styles.completeText}>{completedText}</Text>
                    </View>
                )}
            </View>
            {isClaimable && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={claimText}
                    onPress={handleClaim}
                    hitSlop={8}
                    style={({ pressed }) => [
                        styles.claimButton,
                        (pressed || isClaiming) && styles.claimButtonPressed,
                    ]}
                    disabled={isClaiming}
                >
                    {isClaiming
                        ? <ActivityIndicator size="small" color={colors.onAccent} />
                        : (
                            <>
                                <FontAwesome5Icon name="gift" size={13} color={colors.onAccent} solid />
                                <Text style={styles.claimText} numberOfLines={1}>{claimText}</Text>
                            </>
                        )}
                </Pressable>
            )}
        </Pressable>
    );
};

export default AchievementTile;
