import { IPactNudgeResult } from 'therr-react/types';

/**
 * `IPactNudgeResult.reason` gains `'undeliverable'` in the shared half of this work (the
 * users-service change, on `general`). Widening it here keeps this branch compiling before
 * that lands and stays correct afterwards — a union only ever grows.
 */
export type INudgeResult = Omit<IPactNudgeResult, 'reason'> & {
    reason?: IPactNudgeResult['reason'] | 'undeliverable';
};

export type NudgeToastType = 'success' | 'warn' | 'error';

export interface INudgeToast {
    type: NudgeToastType;
    /** Dictionary key for the toast headline. */
    key: string;
    params?: { [key: string]: string | number };
}

/**
 * Picks the toast for a nudge that the server accepted.
 *
 * `PUT /habits/pacts/:id/nudge` answers 200 even when nothing was delivered — the per-partner
 * cooldown, unreachable partners and dispatch failures are all reported inside `nudgeResults`.
 * Collapsing every one of those into "Could not send the nudge. Please try again." told the
 * user nothing about whether to retry, wait, or fix the partner's contact details, so each
 * outcome gets its own copy here.
 *
 * `formatDate` is injected rather than imported so the caller supplies the reader's locale.
 */
export const getNudgeOutcomeToast = (
    results: INudgeResult[] | undefined | null,
    formatDate: (isoDate: string) => string,
): INudgeToast => {
    const outcomes = results || [];

    // An older server (or a response shape we don't recognise) reports no per-partner detail.
    // The request itself succeeded, so treat it as sent rather than inventing a failure.
    if (outcomes.length === 0) {
        return { type: 'success', key: 'pages.pacts.outgoing.nudgeSuccess' };
    }

    const nudgedCount = outcomes.filter((outcome) => outcome.nudged).length;

    if (nudgedCount === outcomes.length) {
        return { type: 'success', key: 'pages.pacts.outgoing.nudgeSuccess' };
    }

    if (nudgedCount > 0) {
        return {
            type: 'warn',
            key: 'pages.pacts.outgoing.nudgePartial',
            params: { nudgedCount, totalCount: outcomes.length },
        };
    }

    const cooldowns = outcomes.filter((outcome) => outcome.reason === 'cooldown');

    if (cooldowns.length) {
        // The soonest any partner becomes nudgeable again is when the button is worth pressing.
        const availableAt = cooldowns
            .map((outcome) => outcome.nextNudgeAvailableAt)
            .filter((value): value is string => !!value)
            .sort()[0];

        return availableAt
            ? {
                type: 'warn',
                key: 'pages.pacts.outgoing.nudgeCooldownUntil',
                params: { date: formatDate(availableAt) },
            }
            : { type: 'warn', key: 'pages.pacts.outgoing.nudgeCooldown' };
    }

    if (outcomes.some((outcome) => outcome.reason === 'undeliverable')) {
        return { type: 'error', key: 'pages.pacts.outgoing.nudgeUndeliverable' };
    }

    return { type: 'error', key: 'pages.pacts.outgoing.nudgeError' };
};

/**
 * Picks the body copy for a nudge the server rejected.
 *
 * The API's error bodies are localized and specific ("Only the person who created this pact
 * can send a nudge"), and the axios interceptor rejects with that body verbatim — so when one
 * is present it beats anything this screen could say. A rejection with no `statusCode` never
 * reached the API, so it is reported as a connection problem instead of a nudge problem.
 */
export const getNudgeErrorMessage = (error: any): { key?: string; message?: string } => {
    if (error?.statusCode && typeof error?.message === 'string' && error.message) {
        return { message: error.message };
    }

    return { key: 'pages.pacts.outgoing.nudgeErrorOffline' };
};
