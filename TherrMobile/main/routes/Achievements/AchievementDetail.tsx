import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import AchievementArt from './AchievementArt';
import { BADGE_ASPECT } from '../../components/Achievements/HabitsAchievementBadge';
import { getBadgeStateColors, getBadgeTone } from '../../styles/achievements/badgePalette';
import {
    getAchievementClassName,
    IAchievementBadge,
    toRomanNumeral,
} from '../../utilities/achievementCollection';
import { formatRewardAmount } from '../../utilities/achievements';
import formatCalendarDate from '../../utilities/formatCalendarDate';

const achievementConfetti = require('../../assets/achievement-confetti-2.json');

/** Width of the badge at the top of the detail screen. */
export const DETAIL_BADGE_WIDTH = 132;

export interface IAchievementDetailProps {
    badge: IAchievementBadge;
    /** Every badge on the same ladder, in climbing order. */
    track: IAchievementBadge[];
    /** The reward was claimed a moment ago — confetti, and the reward reads as a gain. */
    isCelebrating: boolean;
    /** A claim request is in flight. */
    isClaiming: boolean;
    /** Someone else's badge: nothing to claim. */
    isReadOnly: boolean;
    /** False until the push transition has finished; holds the Lottie back until then. */
    showAnimation: boolean;
    onClaim: () => void;
    onSelectBadge: (badge: IAchievementBadge) => void;
    themeAchievements: any;
    translate: (key: string, params?: any) => string;
}

/**
 * Everything about one badge.
 *
 * The screen this replaces showed the card, the title, a line of encouragement that
 * read "You're almost there!" at 1 of 50, and the reward as two sentences of body
 * text — with confetti looping over an achievement that had not been earned. It never
 * said what the achievement asked for, how far along the user was, or where it sat on
 * its ladder, and a finished one told the user to go back and find the claim button.
 *
 * In order, this answers: what is it, what does it ask, how far am I, what do I get,
 * and what comes after it.
 */
const AchievementDetail = ({
    badge,
    track,
    isCelebrating,
    isClaiming,
    isReadOnly,
    showAnimation,
    onClaim,
    onSelectBadge,
    themeAchievements,
    translate,
}: IAchievementDetailProps) => {
    const { styles, colors } = themeAchievements;
    const { config } = badge;
    const tone = getBadgeTone(badge.achievementClass, colors);
    const isLocked = badge.state === 'locked';
    const isInProgress = badge.state === 'inProgress';
    const isClaimable = badge.state === 'claimable';
    const isDone = isClaimable || badge.state === 'earned';
    const className = getAchievementClassName(badge.achievementClass, translate);
    const hasLadder = badge.trackLength > 1;
    const overline = hasLadder
        ? `${className} · ${translate('pages.achievements.info.level', { level: toRomanNumeral(badge.level) })}`
        : className;
    const remaining = Math.max(0, config.countToComplete - badge.progressCount);
    const earnedOn = isDone ? formatCalendarDate(badge.userAchievement?.completedAt, translate) : '';
    const coins = formatRewardAmount(config.pointReward);
    const xp = formatRewardAmount(config.xp);
    const rewardPrefix = isCelebrating ? '+' : '';
    let rewardsLabel = translate('pages.achievements.labels.rewards');
    if (isCelebrating) {
        rewardsLabel = translate('pages.achievements.labels.rewardsEarned');
    } else if (badge.state === 'earned' && !isReadOnly) {
        rewardsLabel = translate('pages.achievements.labels.rewardsClaimed');
    }

    return (
        <View style={styles.detailContainer}>
            <View style={styles.detailHero}>
                {/* A disc of the class colour behind the card, so the badge has a stage rather than a blank page. */}
                <View
                    style={[
                        styles.detailHalo,
                        { backgroundColor: isLocked ? colors.backgroundNeutral : tone.from },
                        isLocked && styles.detailHaloLocked,
                    ]}
                />
                {isCelebrating && showAnimation && (
                    <LottieView
                        source={achievementConfetti}
                        resizeMode="cover"
                        speed={1}
                        autoPlay
                        loop={false}
                        style={styles.detailConfetti}
                    />
                )}
                <View
                    style={[
                        styles.detailBadgeFrame,
                        { width: DETAIL_BADGE_WIDTH, height: DETAIL_BADGE_WIDTH * BADGE_ASPECT },
                        isDone && styles.detailBadgeFrameEarned,
                    ]}
                >
                    <AchievementArt
                        achievementClass={badge.achievementClass}
                        track={badge.track}
                        state={badge.state}
                        level={badge.level}
                        isCapstone={badge.isCapstone}
                        width={DETAIL_BADGE_WIDTH}
                        animate={showAnimation && isDone}
                        theme={themeAchievements}
                    />
                </View>
            </View>

            <Text style={styles.detailOverline}>{overline}</Text>
            <Text style={styles.detailTitle} accessibilityRole="header">{config.title}</Text>
            <Text style={styles.detailDescription}>{config.description}</Text>

            {isCelebrating && (
                <Text style={styles.detailNote}>{translate('pages.achievements.info.congratulations')}</Text>
            )}

            {isInProgress && (
                <View style={styles.detailProgress}>
                    <View style={styles.detailProgressLabels}>
                        <Text style={styles.detailProgressCount}>
                            {translate('pages.achievements.info.progressOf', {
                                count: badge.progressCount,
                                total: config.countToComplete,
                            })}
                        </Text>
                        {!isReadOnly && remaining > 0 && (
                            <Text style={styles.detailProgressRemaining}>
                                {translate('pages.achievements.info.remaining', { count: remaining })}
                            </Text>
                        )}
                    </View>
                    <View style={styles.detailProgressTrack}>
                        <View
                            style={[
                                styles.detailProgressFill,
                                { width: `${badge.progressRatio * 100}%`, backgroundColor: tone.from },
                            ]}
                        />
                    </View>
                </View>
            )}

            {isDone && !!earnedOn && (
                <View style={[styles.detailStatusChip, styles.detailStatusChipEarned]}>
                    <FontAwesome5Icon name="check" size={11} color={colors.alertSuccess} solid />
                    <Text style={[styles.detailStatusText, styles.detailStatusTextEarned]}>
                        {translate('pages.achievements.info.earnedOn', { date: earnedOn })}
                    </Text>
                </View>
            )}

            {isLocked && (
                <>
                    <View style={styles.detailStatusChip}>
                        <FontAwesome5Icon name="lock" size={10} color={colors.onSurfaceMuted} solid />
                        <Text style={styles.detailStatusText}>{translate('pages.achievements.states.locked')}</Text>
                    </View>
                    <Text style={styles.detailNote}>{translate('pages.achievements.info.lockedHint')}</Text>
                </>
            )}

            {(!!coins || !!xp) && (
                <View style={styles.detailRewards}>
                    <Text style={styles.detailRewardsLabel}>{rewardsLabel}</Text>
                    <View style={styles.detailRewardsRow}>
                        {!!coins && (
                            <View style={styles.detailReward}>
                                <View style={[styles.detailRewardIcon, styles.detailRewardIconCoins]}>
                                    <FontAwesome5Icon name="coins" size={14} color={colors.accent} solid />
                                </View>
                                <View>
                                    <Text style={styles.detailRewardValue}>{`${rewardPrefix}${coins}`}</Text>
                                    <Text style={styles.detailRewardUnit}>{translate('pages.achievements.labels.coins')}</Text>
                                </View>
                            </View>
                        )}
                        {!!coins && !!xp && <View style={styles.detailRewardDivider} />}
                        {!!xp && (
                            <View style={styles.detailReward}>
                                <View style={[styles.detailRewardIcon, styles.detailRewardIconXp]}>
                                    <FontAwesome5Icon name="bolt" size={14} color={themeAchievements.textColors.brand} solid />
                                </View>
                                <View>
                                    <Text style={styles.detailRewardValue}>{`${rewardPrefix}${xp}`}</Text>
                                    <Text style={styles.detailRewardUnit}>{translate('pages.achievements.labels.xp')}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {isClaimable && !isReadOnly && !isCelebrating && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.achievements.info.claimRewards')}
                    onPress={onClaim}
                    disabled={isClaiming}
                    style={({ pressed }) => [
                        styles.detailClaimButton,
                        (pressed || isClaiming) && styles.claimButtonPressed,
                    ]}
                    testID="achievement-detail-claim"
                >
                    {isClaiming
                        ? <ActivityIndicator size="small" color={colors.onAccent} />
                        : (
                            <>
                                <FontAwesome5Icon name="gift" size={15} color={colors.onAccent} solid />
                                <Text style={styles.detailClaimText}>
                                    {translate('pages.achievements.info.claimRewards')}
                                </Text>
                            </>
                        )}
                </Pressable>
            )}

            {hasLadder && (
                <View style={styles.detailLadder}>
                    <Text style={styles.detailRewardsLabel}>
                        {translate('pages.achievements.info.levelOf', { level: badge.level, total: badge.trackLength })}
                    </Text>
                    <View style={styles.detailLadderRow}>
                        {track.map((step, index) => {
                            const stepDone = step.state === 'earned' || step.state === 'claimable';
                            const stepColors = getBadgeStateColors(
                                stepDone ? 'earned' : (step.state as 'inProgress' | 'locked'),
                                tone,
                                colors,
                            );
                            const isSelected = step.key === badge.key;
                            const previousDone = index > 0
                                && (track[index - 1].state === 'earned' || track[index - 1].state === 'claimable');

                            return (
                                <React.Fragment key={step.key}>
                                    {index > 0 && (
                                        <View
                                            style={[
                                                styles.detailLadderLink,
                                                previousDone && stepDone && { backgroundColor: tone.from },
                                            ]}
                                        />
                                    )}
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isSelected }}
                                        accessibilityLabel={`${translate('pages.achievements.info.level', { level: step.level })}. `
                                            + `${step.config.title}. ${translate(`pages.achievements.states.${step.state}`)}`}
                                        onPress={() => onSelectBadge(step)}
                                        hitSlop={8}
                                        style={[
                                            styles.detailLadderStep,
                                            { backgroundColor: stepColors.groundFrom, borderColor: stepColors.groundFrom },
                                            step.state === 'inProgress' && { borderColor: tone.from },
                                            isSelected && styles.detailLadderStepSelected,
                                            isSelected && { borderColor: colors.onSurface },
                                        ]}
                                        testID={`achievement-detail-step-${step.achievementId}`}
                                    >
                                        {stepDone
                                            ? <FontAwesome5Icon name="check" size={10} color={stepColors.ink} solid />
                                            : (
                                                <Text
                                                    allowFontScaling={false}
                                                    style={[styles.detailLadderStepText, { color: stepColors.ink }]}
                                                >
                                                    {step.level}
                                                </Text>
                                            )}
                                    </Pressable>
                                </React.Fragment>
                            );
                        })}
                    </View>
                </View>
            )}
        </View>
    );
};

export default AchievementDetail;
