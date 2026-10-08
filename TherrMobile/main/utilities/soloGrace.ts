import { IUserHabitEligibility } from 'therr-react/types';
import { readApiError } from './apiErrorMessage';

/**
 * The first-habit solo grace (users-service `helpers/soloHabitAccess.ts`, #3010).
 *
 * A user's first solo habit needs no invite: it is free to track alone for `soloGraceDays`, and
 * after that a check-in on it needs `soloGraceKeepInviteCount` invites sent. The server enforces
 * it; this module only reads what the server said, so the overlay, the first check-in and the
 * refusal handling cannot disagree about it.
 *
 * Kept free of react-native imports so it stays unit-testable.
 */

/**
 * The eligibility the grace is read from. The grace fields are optional on `IUserHabitEligibility`:
 * a server predating the grace sends none of them, and every reader treats their absence as
 * "no grace".
 */
export type IEligibilityWithSoloGrace = IUserHabitEligibility;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whether a brand-new user may start their first habit alone right now — the condition for
 * leading onboarding with "pick your first habit" instead of "invite a friend".
 */
export const isFirstHabitGraceAvailable = (
    eligibility: IEligibilityWithSoloGrace | null | undefined,
    isSoloEnabled: boolean,
): boolean => isSoloEnabled && eligibility?.isSoloGraceAvailable === true;

/** Free days the grace offers, from the server. Null when it did not say. */
export const getSoloGraceDays = (eligibility: IEligibilityWithSoloGrace | null | undefined): number | null => (
    typeof eligibility?.soloGraceDays === 'number' && eligibility.soloGraceDays > 0 ? eligibility.soloGraceDays : null
);

/**
 * Whole days left on a spent grace, floored at 0; null when there is no grace window to count.
 */
export const getSoloGraceDaysLeft = (
    eligibility: IEligibilityWithSoloGrace | null | undefined,
    now: Date = new Date(),
): number | null => {
    const endsAt = eligibility?.soloGrace?.endsAt ? new Date(eligibility.soloGrace.endsAt).getTime() : NaN;
    if (!Number.isFinite(endsAt)) {
        return null;
    }
    return Math.max(0, Math.ceil((endsAt - now.getTime()) / MS_PER_DAY));
};

export interface ISoloGraceEnded {
    habitGoalId: string;
    /** Invites needed to keep the habit going. */
    requiredCount: number;
}

/**
 * The server's refusal of a check-in on a grace habit whose window has passed with no invite sent
 * (403 `solo-grace-ended`), or null for any other error. The way forward is inviting someone to
 * that habit, so a screen that gets a value here should offer that rather than an error toast.
 */
export const readSoloGraceEnded = (err: any): ISoloGraceEnded | null => {
    const { status, body } = readApiError(err);

    if (status !== 403 || body?.error !== 'solo-grace-ended' || typeof body?.habitGoalId !== 'string') {
        return null;
    }

    return {
        habitGoalId: body.habitGoalId,
        requiredCount: typeof body.requiredCount === 'number' ? body.requiredCount : 1,
    };
};
