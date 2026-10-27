import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';

/**
 * A leading emoji per notification type, so a stack of pushes that land together
 * can be told apart at a glance instead of read one by one. Habits sends several
 * pushes inside the same few minutes (digest, partner check-ins, leaderboard), and
 * with plain-text titles they read as one undifferentiated block — the kind users
 * swipe away wholesale.
 *
 * Kept in code rather than in the locale dictionaries: the emoji is the same in
 * every language, and one table is the only way to keep it consistent across
 * `en-us`, `es` and `fr-ca` and unique across types.
 *
 * Keyed exhaustively so a new type fails to compile until it is given one. Every
 * value must be distinct (`notificationTitleEmoji.test.ts`) — two types sharing an
 * icon defeats the point. Stick to emoji from Unicode 12 or earlier: anything
 * newer renders as tofu on the older Android versions this app still supports.
 */
export const NOTIFICATION_TITLE_EMOJI: Record<PushNotifications.Types, string> = {
    // Social
    [PushNotifications.Types.achievementCompleted]: '🎖️',
    [PushNotifications.Types.connectionRequestAccepted]: '✨',
    [PushNotifications.Types.newConnectionRequest]: '🔗',
    [PushNotifications.Types.newDirectMessage]: '💬',
    [PushNotifications.Types.newGroupInvite]: '📬',
    [PushNotifications.Types.newGroupMessage]: '👥',
    [PushNotifications.Types.newGroupMembers]: '🙌',
    [PushNotifications.Types.newLikeReceived]: '❤️',
    [PushNotifications.Types.newSuperLikeReceived]: '💖',
    [PushNotifications.Types.newThoughtReplyReceived]: '↩️',
    [PushNotifications.Types.newThoughtRepostReceived]: '🔃',
    [PushNotifications.Types.reportConfirmed]: '🛡️',
    [PushNotifications.Types.leaderboardRankMilestone]: '📈',
    [PushNotifications.Types.leaderboardRankLost]: '📉',
    [PushNotifications.Types.leaderboardPodiumWithinReach]: '🥇',

    // Therr map / moments / spaces
    [PushNotifications.Types.newAreasActivated]: '🗺️',
    [PushNotifications.Types.nudgeSpaceEngagement]: '💰',
    [PushNotifications.Types.postVisitReviewReminder]: '⭐',
    [PushNotifications.Types.proximityRequiredMoment]: '🔮',
    [PushNotifications.Types.proximityRequiredSpace]: '📌',

    // Retention automation
    [PushNotifications.Types.createYourProfileReminder]: '👤',
    [PushNotifications.Types.createAMomentReminder]: '📍',
    [PushNotifications.Types.completeDraftReminder]: '📝',
    [PushNotifications.Types.latestPostLikesStats]: '💕',
    [PushNotifications.Types.latestPostViewcountStats]: '👁️',
    [PushNotifications.Types.unreadNotificationsReminder]: '🔔',
    [PushNotifications.Types.unclaimedAchievementsReminder]: '🎁',
    [PushNotifications.Types.inviteFriendsReminder]: '👯',

    // Habits — pacts
    [PushNotifications.Types.pactInvitation]: '💌',
    [PushNotifications.Types.pactNudge]: '👋',
    [PushNotifications.Types.pactAccepted]: '🤝',
    [PushNotifications.Types.pactDeclined]: '🚪',
    [PushNotifications.Types.pactCompleted]: '🏁',
    [PushNotifications.Types.pactExpiring]: '⏳',
    [PushNotifications.Types.pactEnded]: '🔄',
    [PushNotifications.Types.pactJoinRequested]: '🙋',
    [PushNotifications.Types.pactJoinApproved]: '🎊',
    [PushNotifications.Types.openPactSuggestion]: '🔎',
    [PushNotifications.Types.pactInviteUnclaimed]: '📨',

    // Habits — onboarding
    [PushNotifications.Types.habitsFirstHabitNudge]: '🌱',
    [PushNotifications.Types.habitsFounderOffer]: '💎',

    // Habits — growth loops
    [PushNotifications.Types.challengeJoined]: '🚀',
    [PushNotifications.Types.habitsReferralRewardEarned]: '🔓',

    // Habits — partners
    [PushNotifications.Types.partnerCheckedIn]: '✅',
    [PushNotifications.Types.partnerMissedDay]: '👀',
    [PushNotifications.Types.partnerCelebrated]: '🎉',

    // Habits — streaks
    [PushNotifications.Types.streakMilestone]: '🏅',
    [PushNotifications.Types.streakAtRisk]: '🔥',
    [PushNotifications.Types.streakBroken]: '🌅',
    [PushNotifications.Types.newPersonalRecord]: '🏆',
    [PushNotifications.Types.streakFreezeUsed]: '🧊',
    [PushNotifications.Types.pledgeMissed]: '💝',

    // Habits — daily rhythm
    [PushNotifications.Types.dailyHabitReminder]: '⏰',
    [PushNotifications.Types.morningMotivation]: '☀️',
    [PushNotifications.Types.eveningCheckIn]: '🌙',
    [PushNotifications.Types.weeklyRecap]: '📊',

    // Habits — lifecycle
    [PushNotifications.Types.habitEstablished]: '🧱',
    [PushNotifications.Types.habitAutomaticity]: '🧠',
    [PushNotifications.Types.habitMaintenanceCheckIn]: '📋',
    [PushNotifications.Types.habitComeback]: '💪',
};

// Friends with Habits only, for now. Therr's titles are unchanged; add a brand
// here to opt it in — the table already covers every type.
const BRANDS_WITH_TITLE_EMOJI: Set<BrandVariations> = new Set([
    BrandVariations.HABITS,
]);

/**
 * Prefixes `title` with its type's emoji when the brand opts in. A missing type
 * (an untrusted or stale `type` string) or an empty title passes through
 * unchanged, and an already-prefixed title is not prefixed twice.
 */
export const withTitleEmoji = (
    title: string,
    type: string | undefined,
    brandVariation: BrandVariations,
): string => {
    if (!title || !BRANDS_WITH_TITLE_EMOJI.has(brandVariation)) {
        return title;
    }
    // Own keys only: a plain-object lookup of e.g. "constructor" would return a function.
    const emoji = type && Object.prototype.hasOwnProperty.call(NOTIFICATION_TITLE_EMOJI, type)
        ? NOTIFICATION_TITLE_EMOJI[type as PushNotifications.Types]
        : undefined;
    if (!emoji || title.startsWith(emoji)) {
        return title;
    }
    return `${emoji} ${title}`;
};
