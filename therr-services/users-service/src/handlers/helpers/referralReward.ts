import {
    AccessLevels,
    BrandVariations,
    HABITS_LIFETIME_FOUNDER_LIMIT,
    HABITS_REFERRAL_REWARD_ACTIVE_DAYS,
    HABITS_REFERRAL_REWARD_FRIEND_COUNT,
    PushNotifications,
    hasHabitsPremiumEntitlement,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { IReferredFriendRow } from '../../store/ReferralRewardsStore';
import enqueueNotification from '../../utilities/enqueueNotification';
import { mergeAccessLevels } from './checkoutSessionAccessLevels';

/**
 * The founder unlock as a referral reward: bring HABITS_REFERRAL_REWARD_FRIEND_COUNT friends who
 * each check in on HABITS_REFERRAL_REWARD_ACTIVE_DAYS distinct days, and the lifetime entitlement
 * is granted free.
 *
 * Why the founder unlock: it costs no cash to give, it is the thing the paywall already sells, and
 * the person who brings three active friends is worth far more than $20 to an app whose growth
 * loop is "bring a friend". It is offered while founder seats remain, so it ends with the offer it
 * is part of. A referral grant does not take a founder seat — the seats count purchases.
 *
 * Why *active* friends rather than invites sent: the solo unlock already rewards sending invites
 * (`soloHabitAccess.ts`). Paying a lifetime unlock for sends alone would pay for spam. Three
 * friends checking in on three days each is people actually using the app.
 *
 * Abuse resistance, proportionate to a $20 product:
 *   - A friend counts only when their account is about as new as the invite
 *     (`REFERRAL_ACCOUNT_AGE_TOLERANCE`), so a circle of existing users cannot trade credit.
 *   - A friend counts only once their email or phone is verified.
 *   - Days are distinct calendar days, so nine check-ins in one afternoon is one day.
 *
 * Kill switch: HABITS_REFERRAL_REWARD_ENABLED=false.
 */

export const isReferralRewardEnabled = (): boolean => process.env.HABITS_REFERRAL_REWARD_ENABLED !== 'false';

export const REFERRAL_REWARD_DEDUPE_PREFIX = 'habits-referral-reward';

/** The progress list is for display; nobody needs to scroll past this many friends. */
const MAX_FRIENDS_LISTED = 20;

const isVerified = (accessLevels: string[] | null | undefined): boolean => Array.isArray(accessLevels)
    && (accessLevels.includes(AccessLevels.EMAIL_VERIFIED) || accessLevels.includes(AccessLevels.MOBILE_VERIFIED));

export const isQualifyingFriend = (friend: Pick<IReferredFriendRow, 'accessLevels' | 'activeDays'>): boolean => isVerified(friend.accessLevels)
    && friend.activeDays >= HABITS_REFERRAL_REWARD_ACTIVE_DAYS;

export interface IReferralRewardFriend {
    userName: string;
    /** Capped at the requirement, so the client draws "3 of 3" rather than "41 of 3". */
    activeDays: number;
    isVerified: boolean;
    isQualified: boolean;
}

export interface IReferralRewardProgress {
    requiredFriendCount: number;
    requiredActiveDays: number;
    qualifiedCount: number;
    friends: IReferralRewardFriend[];
    isGranted: boolean;
    grantedAt: Date | null;
    /** Already holds the premium entitlement, by purchase or by this reward. */
    isEntitled: boolean;
    /** The offer is on: enabled, and founder seats remain (or it was already earned). */
    isAvailable: boolean;
}

export const getReferralRewardProgress = async (userId: string): Promise<IReferralRewardProgress> => {
    // `accessLevels` is selected explicitly; it arrives undefined otherwise and reads as unentitled.
    const [friends, grant, [user], claimed] = await Promise.all([
        Store.referralRewards.getReferredFriends(userId),
        Store.referralRewards.getByUserId(userId),
        Store.users.findUser({ id: userId }, ['accessLevels']),
        Store.lifetimePurchases.countClaimedFounderSlots(),
    ]);

    const qualifiedCount = friends.filter(isQualifyingFriend).length;
    const isSoldOut = claimed >= HABITS_LIFETIME_FOUNDER_LIMIT;

    return {
        requiredFriendCount: HABITS_REFERRAL_REWARD_FRIEND_COUNT,
        requiredActiveDays: HABITS_REFERRAL_REWARD_ACTIVE_DAYS,
        qualifiedCount,
        friends: friends.slice(0, MAX_FRIENDS_LISTED).map((friend) => ({
            userName: friend.userName,
            activeDays: Math.min(friend.activeDays, HABITS_REFERRAL_REWARD_ACTIVE_DAYS),
            isVerified: isVerified(friend.accessLevels),
            isQualified: isQualifyingFriend(friend),
        })),
        isGranted: !!grant,
        grantedAt: grant?.grantedAt || null,
        isEntitled: hasHabitsPremiumEntitlement((user?.accessLevels as string[]) || []),
        isAvailable: !!grant || (isReferralRewardEnabled() && !isSoldOut),
    };
};

export type ReferralGrantOutcome = 'granted' | 'not-yet' | 'already-granted' | 'already-entitled' | 'disabled' | 'sold-out';

/**
 * Grant the reward to one referrer if they have now earned it. Idempotent: the UNIQUE row in
 * habits.referral_rewards is claimed in the same transaction that moves the access level, so two
 * check-ins evaluating the same referrer at once grant and announce once, and a failed write
 * leaves nothing behind for the next check-in to mistake for a grant.
 */
export const maybeGrantReferralReward = async (referrerUserId: string): Promise<ReferralGrantOutcome> => {
    if (!isReferralRewardEnabled()) {
        return 'disabled';
    }

    if (await Store.referralRewards.getByUserId(referrerUserId)) {
        return 'already-granted';
    }

    // Read accessLevels explicitly. A partially-selected user makes the merge below *replace* the
    // array rather than extend it, which strips EMAIL_VERIFIED — see habitsLifetime.ts.
    const [referrer] = await Store.users.findUser({ id: referrerUserId }, ['id', 'accessLevels']);
    if (!referrer) {
        return 'not-yet';
    }
    if (hasHabitsPremiumEntitlement((referrer.accessLevels as string[]) || [])) {
        // Nothing left to give. Not recorded, so a later refund of their purchase leaves them
        // able to earn it this way.
        return 'already-entitled';
    }

    const friends = await Store.referralRewards.getReferredFriends(referrerUserId);
    const qualifying = friends.filter(isQualifyingFriend);
    if (qualifying.length < HABITS_REFERRAL_REWARD_FRIEND_COUNT) {
        return 'not-yet';
    }

    if (await Store.lifetimePurchases.countClaimedFounderSlots() >= HABITS_LIFETIME_FOUNDER_LIMIT) {
        return 'sold-out';
    }

    const grant = await Store.referralRewards.grant(
        referrerUserId,
        qualifying.map((friend) => friend.userId),
        mergeAccessLevels(referrer.accessLevels, [AccessLevels.HABITS_LIFETIME]),
    );
    if (!grant) {
        return 'already-granted';
    }

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Granted the founder unlock as a referral reward'],
        traceArgs: {
            'user.id': referrerUserId,
            'referral.qualifiedCount': qualifying.length,
        },
    });

    await enqueueNotification({
        brandVariation: BrandVariations.HABITS,
        toUserId: referrerUserId,
        type: PushNotifications.Types.habitsReferralRewardEarned,
        // Once per user, ever: the reward itself can only happen once.
        dedupeKey: `${REFERRAL_REWARD_DEDUPE_PREFIX}:${referrerUserId}`,
    });

    return 'granted';
};

/**
 * Called after a completed check-in: the checking-in user may have just become an active friend
 * for whoever brought them in. Never throws — a check-in must not fail over a reward.
 */
export const evaluateReferralRewardsAfterCheckin = async (friendUserId: string): Promise<ReferralGrantOutcome[]> => {
    if (!isReferralRewardEnabled()) {
        return [];
    }

    try {
        const referrerUserIds = await Store.referralRewards.getReferrersOf(friendUserId);
        const outcomes: ReferralGrantOutcome[] = [];
        // Sequential: almost always zero or one referrer, and parallel grants would race the
        // founder-seat read for no gain.
        // eslint-disable-next-line no-restricted-syntax
        for (const referrerUserId of referrerUserIds) {
            // eslint-disable-next-line no-await-in-loop
            outcomes.push(await maybeGrantReferralReward(referrerUserId));
        }
        return outcomes;
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Referral reward evaluation failed'],
            traceArgs: { 'error.message': err?.message, 'user.id': friendUserId },
        });
        return [];
    }
};

/**
 * Progress for the referrer's own screen, granting the reward first when it is already earned.
 *
 * The check-in hook above only fires when a *friend* checks in, so a referrer whose friends
 * qualified before that hook was deployed, or who all went quiet the day after qualifying, was
 * never evaluated at all. On 2026-10-28 two real users were in exactly that state (three verified
 * friends with 3+ check-in days each, no grant), and `habits.referral_rewards` was empty.
 *
 * Granting here is safe because nothing the client sends decides it: the rule is evaluated by
 * `maybeGrantReferralReward` against server data, and the UNIQUE row makes a repeat a no-op. It
 * runs only when the progress already shows the reward earned and not yet given, so the ordinary
 * read costs nothing extra. A failed grant is logged and the progress is still returned — the
 * screen must not break over the reward, and the next read retries it.
 */
export const getReferralRewardProgressWithCatchUp = async (userId: string): Promise<IReferralRewardProgress> => {
    const progress = await getReferralRewardProgress(userId);
    const isEarnedButNotGiven = !progress.isGranted
        && !progress.isEntitled
        && progress.isAvailable
        && progress.qualifiedCount >= progress.requiredFriendCount;

    if (!isEarnedButNotGiven) {
        return progress;
    }

    try {
        const outcome = await maybeGrantReferralReward(userId);
        return outcome === 'granted' ? await getReferralRewardProgress(userId) : progress;
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Referral reward catch-up grant failed'],
            traceArgs: { 'error.message': err?.message, 'user.id': userId },
        });
        return progress;
    }
};
