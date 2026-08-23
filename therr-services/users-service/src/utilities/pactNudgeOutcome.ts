// Type-only so this module stays free of runtime imports: it is pure decision logic and is
// unit-tested without standing up Stores, Twilio or SES.
import type { IDispatchPactInvitationResult } from './dispatchPactInvitation';

/** 7 days between nudges to the same partner. */
export const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Why a nudge did not reach a partner. The client maps these to specific copy, which is the
 * whole point of returning them: "Could not send the nudge" for every failure told the user
 * nothing about whether to retry, wait, or fix the partner's contact details.
 */
export type NudgeFailureReason =
    /** Nudged within the last NUDGE_COOLDOWN_MS. Retry after `nextNudgeAvailableAt`. */
    | 'cooldown'
    /** No way to reach them: no Habits install, and no email or phone on file. Retrying won't help. */
    | 'undeliverable'
    /** Dispatch threw. Transient as far as we can tell, so retrying is worth offering. */
    | 'error';

export interface INudgeOutcome {
    partnerId: string;
    nudged: boolean;
    reason?: NudgeFailureReason;
    nextNudgeAvailableAt?: string;
}

/**
 * Whether a partner is past their cooldown. A partner never nudged is always eligible.
 */
export const getCooldownOutcome = (
    partnerId: string,
    nudgedAt: string | Date | null | undefined,
    nowMs: number = Date.now(),
): INudgeOutcome | null => {
    if (!nudgedAt) {
        return null;
    }

    const nudgedMs = new Date(nudgedAt).getTime();

    // An unparseable timestamp must not read as "nudged at the epoch" or, worse, produce a
    // NaN comparison that silently falls through to "eligible" with a NaN date attached.
    if (Number.isNaN(nudgedMs) || nowMs - nudgedMs >= NUDGE_COOLDOWN_MS) {
        return null;
    }

    return {
        partnerId,
        nudged: false,
        reason: 'cooldown',
        nextNudgeAvailableAt: new Date(nudgedMs + NUDGE_COOLDOWN_MS).toISOString(),
    };
};

/**
 * Turns a `dispatchPactInvitation` result into a per-partner outcome.
 *
 * `isOnBrand: false` covers three different situations inside that helper — the partner row
 * was missing, the partner had neither email nor phone, or an invite really was sent off-brand
 * — and only the last one delivered anything. Treating all three as success is what made the
 * creator see "Nudge sent! Your partner will be reminded." for a partner who is unreachable,
 * and burned their 7-day cooldown on a nudge that never left the building.
 */
export const classifyDispatchResult = (
    partnerId: string,
    result: IDispatchPactInvitationResult | null | undefined,
): INudgeOutcome => {
    if (!result) {
        return { partnerId, nudged: false, reason: 'error' };
    }

    // On-brand partners are reminded by the brand-scoped push the caller sends next.
    if (result.isOnBrand) {
        return { partnerId, nudged: true };
    }

    if (result.invitedVia) {
        return { partnerId, nudged: true };
    }

    return { partnerId, nudged: false, reason: 'undeliverable' };
};

/**
 * Flattens settled per-partner promises. A rejection means the dispatch/markNudged chain threw
 * for that partner, which is reported rather than dropping the partner from the response.
 */
export const flattenNudgeOutcomes = (
    settled: PromiseSettledResult<INudgeOutcome>[],
    partnerIds: string[],
): INudgeOutcome[] => settled.map((outcome, idx) => (
    outcome.status === 'fulfilled'
        ? outcome.value
        : { partnerId: partnerIds[idx], nudged: false, reason: 'error' as NudgeFailureReason }
));
