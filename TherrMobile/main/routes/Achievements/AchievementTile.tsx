import React from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { achievementsByClass } from 'therr-js-utilities/config';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import HabitsAchievementBadge from '../../components/Achievements/HabitsAchievementBadge';

// Therr's card art. The Habits classes used to borrow from this set ("Habit
// Builder" wore the explorer's compass); on Friends with Habits every class now
// renders HabitsAchievementBadge instead, so only classes Therr itself can earn
// are listed. `weeklyChampion` is brand-agnostic — every brand with a leaderboard
// earns it — and keeps its Lottie on Therr.
const cardImagesLottie: { [key: string]: any } = {
    communityLeader: require('../../assets/socialite-card.json'),
    explorer: require('../../assets/explorer-card.json'),
    influencer: require('../../assets/influencer-card.json'),
    localPatron: require('../../assets/local-patron-card.json'),
    socialite: require('../../assets/socialite-card.json'),
    thinker: require('../../assets/thinker-card.json'),
    weeklyChampion: require('../../assets/influencer-card.json'),
};
const IS_HABITS = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;

const lottieFillStyle = { position: 'absolute' as const, width: '100%' as const, height: '100%' as const };

const AchievementTile = ({
    claimText,
    completedText,
    handleClaim,
    isClaiming,
    onPressAchievement,
    progressText,
    userAchievement,
    themeAchievements,
}) => {
    const achievement = achievementsByClass[userAchievement.achievementClass][userAchievement.achievementId];
    const isComplete = !!userAchievement.completedAt;
    // Clamp so an over-counted progress value can't overflow the track.
    const progressRatio = Math.max(0, Math.min(1, userAchievement.progressCount / achievement.countToComplete));
    const progressPercent = `${(isComplete ? 1 : progressRatio) * 100}%`;
    const progressLabel = progressText({
        count: Math.min(userAchievement.progressCount, achievement.countToComplete),
        total: achievement.countToComplete,
    });
    const hasUnclaimedReward = isComplete && userAchievement.unclaimedRewardPts > 0;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${achievement.title}. ${progressLabel}`}
            style={({ pressed }) => [
                themeAchievements.styles.achievementTile,
                pressed && themeAchievements.styles.achievementTilePressed,
            ]}
            onPress={onPressAchievement}
        >
            <View style={themeAchievements.styles.achievementTileContainer}>
                <View style={themeAchievements.styles.cardImageContainer}>
                    <View style={themeAchievements.styles.cardImage}>
                        {IS_HABITS ? (
                            <HabitsAchievementBadge
                                achievementClass={userAchievement.achievementClass}
                                isComplete={isComplete}
                                theme={themeAchievements}
                            />
                        ) : (
                            <LottieView
                                source={cardImagesLottie[userAchievement.achievementClass] || cardImagesLottie.explorer}
                                resizeMode="cover"
                                speed={1}
                                progress={0}
                                style={lottieFillStyle}
                            />
                        )}
                    </View>
                </View>
                <View style={themeAchievements.styles.tileTextContainer}>
                    <Text style={themeAchievements.styles.achievementClassLabel} numberOfLines={1}>
                        {userAchievement.achievementClass.replace(/([A-Z])/g, ' $1')}
                    </Text>
                    <Text style={themeAchievements.styles.achievementTitle}>
                        {achievement.title}
                    </Text>
                    <Text style={themeAchievements.styles.achievementDescription}>
                        {achievement.description}
                    </Text>
                    <View style={themeAchievements.styles.progressRow}>
                        <View style={themeAchievements.styles.progressBarTrack}>
                            <View
                                style={[
                                    themeAchievements.styles.progressBarFill,
                                    isComplete && themeAchievements.styles.progressBarFillComplete,
                                    { width: progressPercent },
                                ]}
                            />
                        </View>
                        <Text style={themeAchievements.styles.progressLabel}>
                            {progressLabel}
                        </Text>
                    </View>
                </View>
            </View>
            {hasUnclaimedReward && (
                <View style={themeAchievements.styles.completedContainer}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={claimText}
                        onPress={handleClaim}
                        style={({ pressed }) => [
                            themeAchievements.styles.claimButton,
                            (pressed || isClaiming) && themeAchievements.styles.claimButtonPressed,
                        ]}
                        disabled={isClaiming}
                    >
                        {isClaiming
                            ? <ActivityIndicator size="small" color={themeAchievements.colors.onAccent} />
                            : (
                                <>
                                    <FontAwesome5Icon name="gift" size={14} color={themeAchievements.colors.onAccent} />
                                    <Text style={themeAchievements.styles.claimText}>{claimText}</Text>
                                </>
                            )}
                    </Pressable>
                </View>
            )}
            {isComplete && !hasUnclaimedReward && (
                <View style={themeAchievements.styles.completedChip}>
                    <FontAwesome5Icon name="check" size={11} color={themeAchievements.colors.alertSuccess} />
                    <Text style={themeAchievements.styles.completeText}>{completedText}</Text>
                </View>
            )}
        </Pressable>
    );
};

export default AchievementTile;
