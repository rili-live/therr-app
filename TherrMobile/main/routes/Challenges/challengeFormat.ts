/**
 * Shapes and pure helpers for join-by-link challenges. The server owns every rule — who may join,
 * how the board is ranked, when a challenge has ended — and these only turn its answer into words.
 * See users-service `handlers/challenges.ts` and `utilities/challengeStandings.ts`.
 */

export const CHALLENGE_DURATIONS = [7, 14, 30, 60, 90];
export const DEFAULT_CHALLENGE_DURATION = 30;
export const CHALLENGE_TITLE_MAX_LENGTH = 100;

/** A join token, exactly as the server mints it: 12 base62 characters. */
export const JOIN_TOKEN_RE = /^[A-Za-z0-9]{12}$/;

/**
 * A challenge link opened on the device: https://habits.therr.com/c/<token>, with or without
 * `www.`, a trailing slash or a query. The card image path (`/c/<token>/card.png`) is not a link
 * anyone shares, so it is deliberately not matched.
 */
const CHALLENGE_URL_RE = /^https?:\/\/(?:www\.)?habits\.therr\.com\/c\/([A-Za-z0-9]{12})\/?(?:[?#].*)?$/i;

export const parseChallengeUrl = (url?: string | null): string | null => {
    const match = (url || '').trim().match(CHALLENGE_URL_RE);
    return match ? match[1] : null;
};

export const buildChallengeUrl = (joinToken: string): string => `https://habits.therr.com/c/${joinToken}`;

export interface IChallengeStanding {
    rank: number;
    userName: string;
    displayName: string;
    checkinDays: number;
    totalAmount: number;
    lastCheckinDate?: string | null;
}

export interface IChallenge {
    id: string;
    joinToken: string;
    title: string;
    habitGoalId: string;
    goal: { name: string; emoji?: string | null; amountUnit?: string | null };
    creator: { userName: string; displayName: string };
    startDate: string;
    endDate: string;
    status: 'active' | 'ended' | 'cancelled';
    hasStarted: boolean;
    hasEnded: boolean;
    daysLeft: number;
    durationDays: number;
    memberCount: number;
    maxMembers: number;
    isFull: boolean;
    rankedBy: 'amount' | 'checkinDays';
    standings: IChallengeStanding[];
    viewer: { isMember: boolean; isCreator: boolean; rank: number | null } | null;
}

/**
 * A response that is really a challenge. The interceptor answers a transient GET failure with
 * `{ data: {} }`, which must read as "could not load" rather than as an empty challenge.
 */
export const isChallenge = (value: any): value is IChallenge => !!value
    && typeof value.joinToken === 'string'
    && Array.isArray(value.standings);

type Translate = (key: string, params?: any) => string;

const formatAmount = (amount: number): string => {
    const rounded = Math.round(amount * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/** "12 days" or "42.5 km". */
export const formatChallengeScore = (
    standing: Pick<IChallengeStanding, 'checkinDays' | 'totalAmount'>,
    challenge: Pick<IChallenge, 'rankedBy' | 'goal'>,
    translate: Translate,
): string => {
    if (challenge.rankedBy === 'amount') {
        const amount = formatAmount(standing.totalAmount);
        return challenge.goal.amountUnit ? `${amount} ${challenge.goal.amountUnit}` : amount;
    }
    return translate(
        standing.checkinDays === 1 ? 'pages.challenges.scoreDay' : 'pages.challenges.scoreDays',
        { count: standing.checkinDays },
    );
};

/** "8 days left", "Last day", "Starts tomorrow", "Final results". */
export const formatChallengeTimeLeft = (
    challenge: Pick<IChallenge, 'hasStarted' | 'hasEnded' | 'daysLeft'>,
    translate: Translate,
): string => {
    if (challenge.hasEnded) {
        return translate('pages.challenges.timeEnded');
    }
    if (!challenge.hasStarted) {
        return translate('pages.challenges.timeNotStarted');
    }
    if (challenge.daysLeft === 1) {
        return translate('pages.challenges.timeLastDay');
    }
    return translate('pages.challenges.timeDaysLeft', { count: challenge.daysLeft });
};

/** What a viewer can do here. The server re-checks all of it; this only picks the buttons. */
export const getChallengeActions = (challenge: Pick<IChallenge, 'viewer' | 'hasEnded' | 'isFull' | 'status'>) => {
    const isMember = !!challenge.viewer?.isMember;
    const isCreator = !!challenge.viewer?.isCreator;
    const isRunning = challenge.status !== 'cancelled' && !challenge.hasEnded;

    return {
        canJoin: !isMember && isRunning && !challenge.isFull,
        canShare: isRunning,
        canOpenHabit: isMember,
        canLeave: isMember && !isCreator,
        canEnd: isCreator && isRunning,
    };
};

/** The text that goes into the share sheet, naming the leader once someone has checked in. */
export const buildChallengeShareMessage = (challenge: IChallenge, translate: Translate): string => {
    const url = buildChallengeUrl(challenge.joinToken);
    const leader = challenge.standings[0];
    if (leader && (leader.checkinDays > 0 || leader.totalAmount > 0)) {
        return translate('pages.challenges.shareMessageWithLeader', {
            title: challenge.title,
            leader: leader.displayName,
            score: formatChallengeScore(leader, challenge, translate),
            url,
        });
    }
    return translate('pages.challenges.shareMessage', {
        title: challenge.title,
        days: challenge.durationDays,
        url,
    });
};

export interface IReferralRewardFriend {
    userName: string;
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
    isEntitled: boolean;
    isAvailable: boolean;
}

export const isReferralRewardProgress = (value: any): value is IReferralRewardProgress => !!value
    && typeof value.requiredFriendCount === 'number'
    && Array.isArray(value.friends);

/**
 * Whether the referral card has anything to offer this user. Hidden once they hold the
 * entitlement however they got it, and when the offer is off or sold out.
 */
export const shouldShowReferralReward = (progress?: IReferralRewardProgress | null): boolean => !!progress
    && progress.isAvailable
    && !progress.isEntitled
    && !progress.isGranted;
