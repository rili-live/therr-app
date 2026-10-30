import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { HabitsChallengesService } from 'therr-react/services';
import {
    IReferralRewardProgress,
    isReferralRewardProgress,
    shouldShowReferralReward,
} from '../../routes/Challenges/challengeFormat';
import { logAppEvent } from '../../utilities/analyticsEvents';

interface IReferralRewardCardProps {
    navigation: any;
    themeHabits: any;
    translate: (key: string, params?: any) => string;
    /** Where the card is shown, for the analytics event. */
    source: 'paywall' | 'my-habits' | 'pact-invite';
    userId?: string;
    /**
     * `inline` is the version shown at the moment of inviting (the pact wizard's partner step):
     * the offer and the progress only. No friend roster, and no "Invite a friend" button, since
     * the screen it sits on is already the invite.
     */
    variant?: 'full' | 'inline';
}

/** Friend rows shown before "and N more". The card is a nudge, not a roster. */
const MAX_FRIENDS_SHOWN = 4;

/**
 * "Get it free: bring 3 friends" — progress toward the founder unlock earned by referral.
 *
 * The rule lives on the server (users-service `helpers/referralReward.ts`): friends who joined
 * through this user's pact invite, challenge or invite link, verified, and active on 3 distinct
 * days. The grant happens on the friend's check-in, or on this card's read when the reward was
 * earned but never evaluated; either way the server decides, and this card only renders progress.
 *
 * Renders nothing when the offer does not apply — already paid, already earned, offer off or
 * sold out — or when the read fails, so it can never be the thing that breaks a screen.
 */
const ReferralRewardCard: React.FC<IReferralRewardCardProps> = ({
    navigation,
    themeHabits,
    translate,
    source,
    userId,
    variant = 'full',
}) => {
    const [progress, setProgress] = useState<IReferralRewardProgress | null>(null);
    const isMounted = useRef(true);
    const { styles } = themeHabits;

    useEffect(() => {
        isMounted.current = true;
        // Started inside a promise so a synchronous throw lands in the catch below too: this
        // card sits on the pact wizard's partner step, and must never be what breaks it.
        Promise.resolve()
            .then(() => HabitsChallengesService.getReferralReward())
            .then((response: any) => {
                if (isMounted.current && isReferralRewardProgress(response?.data)) {
                    setProgress(response.data);
                    if (shouldShowReferralReward(response.data)) {
                        logAppEvent('habit_referral_reward_view', {
                            userId,
                            source,
                            qualifiedCount: response.data.qualifiedCount,
                        });
                    }
                }
            })
            .catch(() => undefined);
        return () => { isMounted.current = false; };
    }, [source, userId]);

    if (!progress || !shouldShowReferralReward(progress)) {
        return null;
    }

    const required = progress.requiredFriendCount;
    const qualified = Math.min(progress.qualifiedCount, required);
    const remaining = required - qualified;
    const isInline = variant === 'inline';
    const shownFriends = isInline ? [] : progress.friends.slice(0, MAX_FRIENDS_SHOWN);
    const hiddenCount = isInline ? 0 : progress.friends.length - shownFriends.length;

    return (
        <View style={styles.challengeCard}>
            <Text style={styles.challengeSectionTitle}>
                {translate('pages.referralReward.title', { count: required })}
            </Text>
            <Text style={styles.challengeHint}>
                {translate('pages.referralReward.body', { count: required, days: progress.requiredActiveDays })}
            </Text>

            <View
                style={styles.referralProgressTrack}
                accessible
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: required, now: qualified }}
                accessibilityLabel={translate('pages.referralReward.progress', { qualified, required })}
            >
                <View style={[styles.referralProgressFill, { width: `${Math.round((qualified / required) * 100)}%` }]} />
            </View>
            <Text style={styles.challengeHint}>
                {remaining > 0
                    ? translate('pages.referralReward.progressRemaining', { qualified, required, remaining })
                    : translate('pages.referralReward.progressDone')}
            </Text>

            {shownFriends.map((friend) => (
                <View key={friend.userName} style={styles.challengeStandingRow}>
                    <Text style={styles.challengeName} numberOfLines={1}>{friend.userName}</Text>
                    <Text style={styles.challengeHint}>
                        {friend.isQualified
                            ? translate('pages.referralReward.friendDone')
                            : !friend.isVerified
                                ? translate('pages.referralReward.friendUnverified')
                                : translate('pages.referralReward.friendDays', {
                                    days: friend.activeDays,
                                    required: progress.requiredActiveDays,
                                })}
                    </Text>
                </View>
            ))}
            {hiddenCount > 0 && (
                <Text style={styles.challengeHint}>{translate('pages.referralReward.moreFriends', { count: hiddenCount })}</Text>
            )}

            {!isInline && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.referralReward.cta')}
                    onPress={() => {
                        logAppEvent('habit_referral_reward_cta', { userId, source });
                        navigation.navigate('CreatePactInvite');
                    }}
                    style={({ pressed }) => [styles.challengeSecondaryButton, styles.referralCta, pressed && styles.pressedOpacity]}
                >
                    <Text style={styles.challengeSecondaryButtonText}>{translate('pages.referralReward.cta')}</Text>
                </Pressable>
            )}
        </View>
    );
};

export default ReferralRewardCard;
