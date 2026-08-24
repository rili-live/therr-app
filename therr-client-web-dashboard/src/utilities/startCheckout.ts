import ReactGA from 'react-ga4';
import { UsersService } from 'therr-react/services';
import { getStoredAttribution } from 'therr-react/utilities/attribution';
import * as globalConfig from '../../../global-config';

const envVars = globalConfig[process.env.NODE_ENV];

export type CheckoutPlan = 'basic' | 'advanced' | 'pro';
export type CheckoutBillingPeriod = 'monthly' | 'annual';

/**
 * The original Stripe **Payment Links**, kept as the fallback path.
 *
 * These are why no `purchase` event has ever existed: each opened in a new
 * tab, which is a new GA4 session, so the sale could never be joined to the
 * campaign that produced it. They remain wired up because
 * `isStripeCheckoutSessionsEnabled` is off in production until the plan →
 * Stripe product mapping in the users-service is confirmed against the Stripe
 * dashboard — checkout keeps working exactly as before until it is.
 *
 * Note all three menu components historically pointed at the *basic* link even
 * while labelling the button "Upgrade to Pro". Preserved verbatim rather than
 * corrected here: fixing it changes what a customer is charged, which is the
 * same verification this whole flag is waiting on.
 */
export const LEGACY_PAYMENT_LINKS: Record<CheckoutPlan, string> = {
    basic: 'https://buy.stripe.com/3cs7tkcsZ6z4fTy7ss',
    advanced: 'https://buy.stripe.com/aEUdRI78F0aGePu6op',
    pro: 'https://buy.stripe.com/8wM14W64Bg9E36M146',
};

export interface IStartCheckoutArgs {
    plan: CheckoutPlan;
    billingPeriod?: CheckoutBillingPeriod;
    /** Where the `clicked_upgrade_btn` event says the click came from. */
    eventSource: string;
}

/**
 * Send the buyer to Stripe.
 *
 * Navigates in the **same tab** on purpose. The returning
 * `/payment-complete/:sessionId` route is where the GA4 `purchase` event
 * fires, and only a same-tab round trip keeps that event in the session that
 * carries the campaign. Any change back to `target="_blank"` here silently
 * re-breaks revenue attribution.
 */
export const startCheckout = async ({
    plan,
    billingPeriod = 'monthly',
    eventSource,
}: IStartCheckoutArgs): Promise<void> => {
    ReactGA.event('clicked_upgrade_btn', {
        source: eventSource,
        plan,
        billingPeriod,
    });

    if (!envVars.isStripeCheckoutSessionsEnabled) {
        window.open(LEGACY_PAYMENT_LINKS[plan], '_blank', 'noopener,noreferrer');
        return;
    }

    // Fired before the redirect, not after: once the browser leaves for
    // Stripe there is no guarantee a queued hit is ever sent, and this is the
    // last event on our own origin before checkout.
    ReactGA.event('begin_checkout', {
        plan,
        billingPeriod,
    });

    try {
        const { data } = await UsersService.createCheckoutSession({
            plan,
            billingPeriod,
            cancelPath: `${window.location.pathname}${window.location.search}`,
            userAcquisition: getStoredAttribution() || undefined,
        });

        if (data?.url) {
            window.location.assign(data.url);
            return;
        }

        throw new Error('Checkout session response carried no URL');
    } catch {
        // Never strand a buyer on a dead button. The legacy link still
        // completes a real purchase, and the subscription webhook grants the
        // access level regardless of which path was used — the only thing lost
        // is the attribution this change exists to gain.
        window.open(LEGACY_PAYMENT_LINKS[plan], '_blank', 'noopener,noreferrer');
    }
};
