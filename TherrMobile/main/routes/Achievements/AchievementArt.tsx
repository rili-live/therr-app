import React from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import HabitsAchievementBadge, { BADGE_ASPECT } from '../../components/Achievements/HabitsAchievementBadge';
import { AchievementBadgeState } from '../../utilities/achievementCollection';
import { radius } from '../../styles/radii';

/**
 * The picture for one achievement, at whatever size the caller needs it.
 *
 * Friends with Habits draws `HabitsAchievementBadge`; Therr plays its Lottie cards.
 * The list tile and the detail screen each used to make that choice themselves, from
 * two copies of the Lottie table that had drifted apart — the detail screen's had no
 * entry for `localPatron`. Everything that shows an achievement now asks here.
 */

// Therr's card art. Only classes Therr itself can earn are listed; `weeklyChampion`
// is brand-agnostic — every brand with a leaderboard earns it — and keeps its Lottie
// on Therr.
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

export interface IAchievementArtProps {
    achievementClass: string;
    track?: string;
    state: AchievementBadgeState;
    level?: number;
    isCapstone?: boolean;
    /** Card width in dp; the height follows the badge's aspect ratio. */
    width: number;
    /**
     * Therr only: play the card's animation once instead of holding its first frame.
     * The detail screen sets it after its push transition has finished.
     */
    animate?: boolean;
    theme: any;
}

const AchievementArt = ({
    achievementClass,
    track,
    state,
    level,
    isCapstone,
    width,
    animate = false,
    theme,
}: IAchievementArtProps) => {
    if (IS_HABITS) {
        return (
            <HabitsAchievementBadge
                achievementClass={achievementClass}
                track={track}
                // A badge with a reward waiting has been earned; the reward is the tile's business.
                state={state === 'claimable' ? 'earned' : state}
                level={level}
                isCapstone={isCapstone}
                width={width}
                theme={theme}
            />
        );
    }

    return (
        <View
            style={[
                styles.lottieFrame,
                { width, height: width * BADGE_ASPECT, backgroundColor: theme.colors.backgroundNeutral },
                (state === 'locked' || state === 'inProgress') && styles.unearned,
            ]}
        >
            <LottieView
                source={cardImagesLottie[achievementClass] || cardImagesLottie.explorer}
                resizeMode="cover"
                speed={animate ? 2.4 : 1}
                autoPlay={animate}
                loop={false}
                progress={animate ? undefined : 0}
                style={styles.lottieFill}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    lottieFrame: {
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    lottieFill: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    unearned: {
        opacity: 0.5,
    },
});

export default AchievementArt;
