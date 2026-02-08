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
export const validatePactParams = (params: {
    durationDays?: number;
    consequenceType?: string;
    consequenceDetails?: object;
}): { valid: boolean; error?: string } => {
    const validDurations = [7, 14, 30, 60, 90];
    if (params.durationDays && !validDurations.includes(params.durationDays)) {
        return {
            valid: false,
            error: `Duration must be one of: ${validDurations.join(', ')} days`,
        };
    }

    const validConsequenceTypes: ConsequenceType[] = ['none', 'donation', 'dare', 'custom'];
    if (params.consequenceType && !validConsequenceTypes.includes(params.consequenceType as ConsequenceType)) {
        return {
            valid: false,
            error: `Consequence type must be one of: ${validConsequenceTypes.join(', ')}`,
        };
    }

    if (params.consequenceType === 'donation' && params.consequenceDetails) {
        const details = params.consequenceDetails as { amount?: number };
        if (!details.amount || details.amount <= 0) {
            return {
                valid: false,
                error: 'Donation amount must be greater than 0',
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
