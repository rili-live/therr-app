import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { Image }  from 'react-native-elements';
import { achievementsByClass } from 'therr-js-utilities/config';

const cardImages = {
    explorer: require('../../assets/explorer-card.png'),
    influencer: require('../../assets/influencer-card.png'),
    socialite: require('../../assets/socialite-card.png'),
};

const AchievementTile = ({ claimText, completedText, handleClaim, onPressAchievement, userAchievement, themeAchievements }) => {
    const achievement = achievementsByClass[userAchievement.achievementClass][userAchievement.achievementId];
    const progressPercent = `${userAchievement.progressCount * 100 / achievement.countToComplete}%`;
    const progressText = `${userAchievement.progressCount}/${achievement.countToComplete}`;

    return (
        <Pressable style={themeAchievements.styles.achievementTile} onPress={onPressAchievement}>
            <View style={themeAchievements.styles.achievementTileContainer}>
                <View style={themeAchievements.styles.cardImageContainer}>
                    <Image
                        source={cardImages[userAchievement.achievementClass]}
                        style={themeAchievements.styles.cardImage}
                    />
                </View>
                <View style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingVertical: 6 }}>
                    <Text style={{ textTransform: 'capitalize', fontWeight: '600', fontSize: 18, paddingBottom: 4 }}>
                        {userAchievement.achievementClass}: <Text style={{ fontWeight: '400' }}>{achievement.title}</Text>
                    </Text>
                    <Text style={{ flex: 1 }}>{achievement.description}</Text>
                    <View style={{ width: '100%', display: 'flex', flexDirection: 'row' }}>
                        <View style={{ position: 'relative', flex: 1 }}>
                            <View style={themeAchievements.styles.progressBarBackground}></View>
                            <View style={[themeAchievements.styles.progressBar, { width: progressPercent }]}></View>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', paddingLeft: 8 }}>
                            {userAchievement.completedAt ? '✓' : progressText}
                        </Text>
                    </View>
                </View>
            </View>
            {
                !!userAchievement.completedAt &&
                <>
                    {
                        userAchievement.unclaimedRewardPts > 0 ?
                            <View style={themeAchievements.styles.completedContainer}>
                                <Pressable onPress={handleClaim} style={themeAchievements.styles.claimButton}>
                                    <Text style={themeAchievements.styles.claimText}>{claimText}</Text>
                                </Pressable>
                            </View> :
                            <Text style={themeAchievements.styles.completeText}>{completedText}</Text>
                    }
                </>
            }
        </Pressable>
    );
};

export default AchievementTile;
