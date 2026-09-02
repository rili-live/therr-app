/**
 * Pact lifecycle and comparison utilities for the HABITS app
 */

export type PactStatus = 'pending' | 'active' | 'completed' | 'abandoned' | 'expired';
export type PactType = 'accountability' | 'challenge' | 'support';
export type ConsequenceType = 'none' | 'donation' | 'dare' | 'custom';

export interface IPactCompletionStats {
    creatorCompletionRate: number;
    partnerCompletionRate: number;
    winnerId: string | null;
    isDraw: boolean;
}

/**
 * Calculate completion rates and determine winner for a completed pact
 */
export const calculatePactCompletionStats = (
    creatorCheckins: { completed: number; total: number },
    partnerCheckins: { completed: number; total: number },
    creatorUserId: string,
    partnerUserId: string,
): IPactCompletionStats => {
    const creatorRate = creatorCheckins.total > 0
        ? Math.round((creatorCheckins.completed / creatorCheckins.total) * 10000) / 100
        : 0;
    const partnerRate = partnerCheckins.total > 0
        ? Math.round((partnerCheckins.completed / partnerCheckins.total) * 10000) / 100
        : 0;

    let winnerId: string | null = null;
    const isDraw = Math.abs(creatorRate - partnerRate) < 0.01; // Less than 0.01% difference

    if (!isDraw) {
        winnerId = creatorRate > partnerRate ? creatorUserId : partnerUserId;
    }

    return {
        creatorCompletionRate: creatorRate,
        partnerCompletionRate: partnerRate,
        winnerId,
        isDraw,
    };
};

/**
 * Check if a pact should be auto-expired
 */
export const shouldExpirePact = (
    status: PactStatus,
    endDate: Date | string | null,
): boolean => {
    if (status !== 'active' || !endDate) {
        return false;
    }

    const end = new Date(endDate);
    const now = new Date();
    return now > end;
};

/**
 * Whether a pact's cycle is over and can therefore be renewed.
 *
 * An `active` pact that is merely past its endDate counts as finished: the
 * digest's sweep will have marked it `expired`, but renewal must not depend on
 * that job having run — a user who opens the app before the nightly digest
 * would otherwise be told their finished pact is "still running".
 *
 * `abandoned` is deliberately absent. Someone who walked away from a pact
 * should start a fresh one deliberately rather than re-run the one they quit,
 * and `pending` never had a cycle to finish in the first place.
 */
export const isPactRenewable = (
    pact: { status: PactStatus | string; endDate?: Date | string | null } | null | undefined,
): boolean => {
    if (!pact) {
        return false;
    }
    if (pact.status === 'completed' || pact.status === 'expired') {
        return true;
    }
    return pact.status === 'active' && shouldExpirePact(pact.status as PactStatus, pact.endDate ?? null);
};

/**
 * Who carries over into the renewed cycle, given the previous cycle's members
 * and whoever tapped renew.
 *
 * Only members who were actually *in* the last cycle come along — `left` and
 * `removed` opted out, and a `pending` invitee never accepted, so re-inviting
 * any of them would turn a renewal into a fresh round of asking people who
 * already said no (or never answered). The renewer is excluded because they
 * join the new pact as its creator.
 */
export const selectRenewalInvitees = (
    members: { userId?: string; status?: string }[],
    renewerUserId: string,
): string[] => Array.from(new Set(members
    .filter((member) => member?.userId
        && member.userId !== renewerUserId
        && (member.status === 'active' || member.status === 'completed'))
    .map((member) => member.userId as string)));

/**
 * Check if a pact invitation has expired (default: 7 days)
 */
export const hasInvitationExpired = (
    createdAt: Date | string,
    expirationDays = 7,
): boolean => {
    const created = new Date(createdAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff > expirationDays;
};

/**
 * Get days remaining in a pact
 */
export const getDaysRemaining = (endDate: Date | string | null): number => {
    if (!endDate) {
        return 0;
    }

    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * Get pact progress percentage
 */
export const getPactProgress = (
    startDate: Date | string | null,
    endDate: Date | string | null,
): number => {
    if (!startDate || !endDate) {
        return 0;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();

    if (totalDuration <= 0) {
        return 100;
    }

    return Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
};

/**
 * Generate a default end date based on duration
 */
export const calculateEndDate = (
    startDate: Date | string,
    durationDays: number,
): Date => {
    const start = new Date(startDate);
    return new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
};

/**
 * Check if user is a participant in the pact
 */
export const isUserInPact = (
    userId: string,
    creatorUserId: string,
    partnerUserId: string | null,
): boolean => userId === creatorUserId || userId === partnerUserId;

/**
 * Get the other participant's user ID
 */
export const getPartnerUserId = (
    userId: string,
    creatorUserId: string,
    partnerUserId: string | null,
): string | null => {
    if (userId === creatorUserId) {
        return partnerUserId;
    }
    if (userId === partnerUserId) {
        return creatorUserId;
    }
    return null;
};

export interface IPactPartnerMember {
    pactId: string;
    userId: string;
    status?: string;
    shouldMuteNotifs?: boolean;
    celebratePartnerCheckins?: boolean;
}

/**
 * Everyone other than `userId` who should hear about their activity, across a
 * set of pacts, deduplicated.
 *
 * `getPartnerUserId` only understands 1:1 pacts — a group pact leaves
 * `partnerUserId` null and tracks everyone in pact_members — so membership is
 * the source of truth here, with getPartnerUserId as the fallback for 1:1
 * pacts that pre-date pact_members and have no member rows at all.
 *
 * `onlyCelebrating` applies each recipient's own per-pact notification
 * preferences (`shouldMuteNotifs`, `celebratePartnerCheckins`). Pass it for
 * pushes; leave it off for silent side effects like achievement credit, which
 * a muted member should still receive.
 */
export const selectPactPartnerIds = (
    pacts: { id: string; creatorUserId: string; partnerUserId: string | null }[],
    membersByPactId: Record<string, IPactPartnerMember[]>,
    userId: string,
    { onlyCelebrating = false }: { onlyCelebrating?: boolean } = {},
): string[] => {
    const partnerIds = new Set<string>();

    pacts.forEach((pact) => {
        const members = membersByPactId[pact.id] || [];

        if (!members.length) {
            const legacyPartnerId = getPartnerUserId(userId, pact.creatorUserId, pact.partnerUserId);
            if (legacyPartnerId) {
                partnerIds.add(legacyPartnerId);
            }
            return;
        }

        members
            .filter((member) => member.userId !== userId && member.status === 'active')
            .filter((member) => !onlyCelebrating
                || (!member.shouldMuteNotifs && member.celebratePartnerCheckins !== false))
            .forEach((member) => partnerIds.add(member.userId));
    });

    return [...partnerIds];
};

/**
 * Check if user is the creator of the pact
 */
export const isCreator = (userId: string, creatorUserId: string): boolean => userId === creatorUserId;

/**
 * Format pact duration for display
 */
export const formatPactDuration = (durationDays: number): string => {
    if (durationDays === 7) return '1 week';
    if (durationDays === 14) return '2 weeks';
    if (durationDays === 30) return '1 month';
    if (durationDays === 60) return '2 months';
    if (durationDays === 90) return '3 months';
    return `${durationDays} days`;
};

/**
 * Get pact status display info
 */
export const getPactStatusInfo = (status: PactStatus): { label: string; color: string } => {
    switch (status) {
        case 'pending':
            return { label: 'Waiting for Partner', color: 'warning' };
        case 'active':
            return { label: 'In Progress', color: 'success' };
        case 'completed':
            return { label: 'Completed', color: 'info' };
        case 'abandoned':
            return { label: 'Abandoned', color: 'error' };
        case 'expired':
            return { label: 'Expired', color: 'neutral' };
        default:
            return { label: 'Unknown', color: 'neutral' };
    }
};

/**
 * Validate pact creation parameters
 */
/**
 * Returns a dictionary key rather than a finished sentence, so the caller can render it in the
 * requesting user's locale. The allowed values travel alongside as `errorParams` because they are
 * data, not copy — a translator should not have to re-list them in every language.
 */
export const validatePactParams = (params: {
    durationDays?: number;
    consequenceType?: string;
    consequenceDetails?: object;
}): { valid: boolean; errorKey?: string; errorParams?: { [key: string]: any } } => {
    const validDurations = [7, 14, 30, 60, 90];
    if (params.durationDays && !validDurations.includes(params.durationDays)) {
        return {
            valid: false,
            errorKey: 'errorMessages.pacts.invalidDuration',
            errorParams: { allowed: validDurations.join(', ') },
        };
    }

    const validConsequenceTypes: ConsequenceType[] = ['none', 'donation', 'dare', 'custom'];
    if (params.consequenceType && !validConsequenceTypes.includes(params.consequenceType as ConsequenceType)) {
        return {
            valid: false,
            errorKey: 'errorMessages.pacts.invalidConsequenceType',
            errorParams: { allowed: validConsequenceTypes.join(', ') },
        };
    }

    if (params.consequenceType === 'donation' && params.consequenceDetails) {
        const details = params.consequenceDetails as { amount?: number };
        if (!details.amount || details.amount <= 0) {
            return {
                valid: false,
                errorKey: 'errorMessages.pacts.invalidDonationAmount',
            };
        }
    }

    return { valid: true };
};

/**
 * Activity types for the pact activity feed
 */
export const PACT_ACTIVITY_TYPES = {
    CHECKIN_COMPLETED: 'checkin_completed',
    CHECKIN_SKIPPED: 'checkin_skipped',
    CELEBRATION_SENT: 'celebration_sent',
    ENCOURAGEMENT_SENT: 'encouragement_sent',
    STREAK_MILESTONE: 'streak_milestone',
    STREAK_BROKEN: 'streak_broken',
    PARTNER_JOINED: 'partner_joined',
    PACT_STARTED: 'pact_started',
    PACT_COMPLETED: 'pact_completed',
} as const;

export type PactActivityType = typeof PACT_ACTIVITY_TYPES[keyof typeof PACT_ACTIVITY_TYPES];

/**
 * Get activity display info
 */
export const getActivityDisplayInfo = (
    activityType: PactActivityType,
    userName: string,
): { message: string; emoji: string } => {
    switch (activityType) {
        case PACT_ACTIVITY_TYPES.CHECKIN_COMPLETED:
            return { message: `${userName} completed their habit!`, emoji: '✅' };
        case PACT_ACTIVITY_TYPES.CHECKIN_SKIPPED:
            return { message: `${userName} skipped today`, emoji: '⏭️' };
        case PACT_ACTIVITY_TYPES.CELEBRATION_SENT:
            return { message: `${userName} sent a celebration!`, emoji: '🎉' };
        case PACT_ACTIVITY_TYPES.ENCOURAGEMENT_SENT:
            return { message: `${userName} sent encouragement`, emoji: '💪' };
        case PACT_ACTIVITY_TYPES.STREAK_MILESTONE:
            return { message: `${userName} hit a streak milestone!`, emoji: '🔥' };
        case PACT_ACTIVITY_TYPES.STREAK_BROKEN:
            return { message: `${userName}'s streak was reset`, emoji: '😢' };
        case PACT_ACTIVITY_TYPES.PARTNER_JOINED:
            return { message: `${userName} joined the pact!`, emoji: '🤝' };
        case PACT_ACTIVITY_TYPES.PACT_STARTED:
            return { message: 'Pact has started!', emoji: '🚀' };
        case PACT_ACTIVITY_TYPES.PACT_COMPLETED:
            return { message: 'Pact completed!', emoji: '🏆' };
        default:
            return { message: 'Activity', emoji: '📝' };
    }
};
