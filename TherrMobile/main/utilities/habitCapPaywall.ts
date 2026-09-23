import { FeatureFlags } from 'therr-js-utilities/constants';
import getConfig from './getConfig';
import { readApiError } from './apiErrorMessage';
import { PaywallSource } from './upgradeNudge';

export interface IHabitCapPaywallParams {
    /** `habit-limit-reached` (active cap) or `habit-start-limit-reached` (starts per window). */
    reason: string;
    /** The active-habit cap, on either reason. */
    limit?: number;
    /** The starts-per-window cap and its window, sent with `habit-start-limit-reached`. */
    startLimit?: number;
    startWindowDays?: number;
    /** Which action was refused, for the paywall's `habits_paywall_view` event. */
    source?: PaywallSource;
}

/**
 * `UpgradePaywall` route params for a refusal at the free-tier habit cap, or null
 * when the error is anything else.
 *
 * The cap answers with 402 and paywall metadata (`error`, `limit`) at every entry
 * point that takes a habit slot: creating or accepting a pact, starting or
 * restoring a solo habit, and a check-in that would start tracking an untracked
 * goal. A 402 is not a failure, so a screen that gets params here should navigate
 * rather than toast.
 *
 * Also null when the paywall route is unavailable. `UpgradePaywall` is only
 * registered with ENABLE_HABITS_LIFETIME_OFFER on (see `routes/index.tsx`), and
 * navigating to an unregistered route is a silent no-op that would swallow the
 * error toast along with it.
 */
export const getHabitCapPaywallParams = (err: any, source?: PaywallSource): IHabitCapPaywallParams | null => {
    const { status, body } = readApiError(err);
    const isPaywallRouteAvailable = getConfig()
        .featureFlags?.[FeatureFlags.ENABLE_HABITS_LIFETIME_OFFER] === true;

    if (status !== 402 || !isPaywallRouteAvailable) {
        return null;
    }

    return {
        reason: body?.error || 'habit-limit-reached',
        limit: body?.limit,
        ...(typeof body?.startLimit === 'number' ? { startLimit: body.startLimit } : {}),
        ...(typeof body?.startWindowDays === 'number' ? { startWindowDays: body.startWindowDays } : {}),
        ...(source ? { source } : {}),
    };
};

export default getHabitCapPaywallParams;
