import React from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { achievementsByClass } from 'therr-js-utilities/config';

const cardImagesLottie: { [key: string]: any } = {
    communityLeader: require('../../assets/socialite-card.json'),
    explorer: require('../../assets/explorer-card.json'),
    influencer: require('../../assets/influencer-card.json'),
    localPatron: require('../../assets/local-patron-card.json'),
    socialite: require('../../assets/socialite-card.json'),
    thinker: require('../../assets/thinker-card.json'),
    // HABITS classes — reuse existing Lottie animations to avoid new design assets
    accountability: require('../../assets/socialite-card.json'),
    cleanBreak: require('../../assets/thinker-card.json'),
    consistency: require('../../assets/influencer-card.json'),
    habitBuilder: require('../../assets/explorer-card.json'),
    pactPioneer: require('../../assets/socialite-card.json'),
    resilience: require('../../assets/thinker-card.json'),
    socialEnergizer: require('../../assets/socialite-card.json'),
    treasureBuilder: require('../../assets/local-patron-card.json'),
    // Leaderboard rank milestones — reuse an existing Lottie until a trophy asset ships
    weeklyChampion: require('../../assets/influencer-card.json'),
};

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
                        <LottieView
                            source={cardImagesLottie[userAchievement.achievementClass] || cardImagesLottie.explorer}
                            resizeMode="cover"
                            speed={1}
                            progress={0}
                            style={lottieFillStyle}
                        />
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
