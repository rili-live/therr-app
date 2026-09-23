import { IPactNudgeResult } from 'therr-react/types';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';

/**
 * The shared half of this work has landed, so `IPactNudgeResult.reason` already carries
 * `'undeliverable'`. The alias stays as the name this module reasons about; it deliberately
 * does not re-widen the union, which would hide a future reason being dropped upstream.
 */
export type INudgeResult = IPactNudgeResult;

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
 * The API's 4xx bodies are localized and specific ("Only the person who created this pact
 * can send a nudge"), and the axios interceptor rejects with that body verbatim — so when one
 * is present it beats anything this screen could say.
 *
 * The other two cases are not interchangeable and used to be conflated. A rejection with no
 * `statusCode` never reached the API, which is a connection problem. A 5xx *did* reach it and
 * carries an internal grep token rather than copy (`SQL:PACTS_ROUTES:ERROR`) — telling that
 * user to check their connection is wrong, and showing them the token is worse. See
 * utilities/apiErrorMessage.
 */
export const getNudgeErrorMessage = (error: any): { key?: string; message?: string } => {
    const apiMessage = getApiErrorMessage(error);
    if (apiMessage) {
        return { message: apiMessage };
    }

    if (Number(error?.statusCode)) {
        return { key: 'pages.pacts.outgoing.nudgeError' };
    }

    return { key: 'pages.pacts.outgoing.nudgeErrorOffline' };
};
