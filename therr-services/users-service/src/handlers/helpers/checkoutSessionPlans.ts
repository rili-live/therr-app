import Stripe from 'stripe';
import logSpan from 'therr-js-utilities/log-or-update-span';
import stripe from '../../api/stripe';
import { productIdMap } from './payment-webhook-handlers';

/**
 * The dashboard's three plan slugs, mapped to the Stripe products they buy.
 *
 * Keys match the `plan` argument `PricingCards` already sends with its
 * `clicked_upgrade_btn` event, so the checkout call and the analytics event
 * name the same thing.
 *
 * Values are the reverse of `productIdMap` in payment-webhook-handlers, which
 * is the module that decides which access level a product grants. Both
 * directions therefore agree by construction — a plan buys the product whose
 * access level the webhook will later grant.
 *
 * > **TODO(zack): confirm these three product ids in the Stripe dashboard
 * > before enabling `isStripeCheckoutSessionsEnabled` in production.**
 * > `productIdMap` already carries an unverified note on the Pro id, and a
 * > wrong mapping here charges a customer for a plan they did not choose. The
 * > flag exists so this code can ship un-armed until that check is done; the
 * > Payment Links keep serving checkout in the meantime.
 */
export const PLAN_PRODUCT_IDS: { [plan: string]: string } = {
    basic: 'prod_OK9dEHmueTGDZ1',
    advanced: 'prod_OK9e5d2awEPukG',
    pro: 'prod_OK9f7dJp7rtPB8',
};

export type BillingPeriod = 'monthly' | 'annual';

/** The dashboard advertises a 14-day free trial on every plan. */
export const TRIAL_PERIOD_DAYS = 14;

export const isValidPlan = (plan: any): boolean => typeof plan === 'string'
    && Object.prototype.hasOwnProperty.call(PLAN_PRODUCT_IDS, plan);

/**
 * Resolve a plan + billing period to a Stripe price id.
 *
 * Prices are looked up from Stripe at request time rather than hardcoded. Two
 * reasons: there is no committed list of `price_*` ids anywhere in this repo
 * to start from, and a price is the thing that changes when a plan is
 * repriced — pinning ids here would mean a code deploy for every price change
 * and a silent charge at the old amount until it happened.
 *
 * Returns `undefined` when the product has no active recurring price for the
 * requested interval, which the caller turns into a 400 rather than guessing
 * at a different interval.
 */
export const resolvePriceId = async (
    plan: string,
    billingPeriod: BillingPeriod,
): Promise<string | undefined> => {
    const productId = PLAN_PRODUCT_IDS[plan];
    if (!productId) return undefined;

    const interval = billingPeriod === 'annual' ? 'year' : 'month';

    const prices = await stripe.prices.list({
        product: productId,
        active: true,
        type: 'recurring',
        limit: 100,
    });

    const match = prices.data.find((price: Stripe.Price) => price.recurring?.interval === interval);

    if (!match) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['No active recurring price for the requested plan interval'],
            traceArgs: {
                'stripe.productId': productId,
                'stripe.interval': interval,
                plan,
            },
        });
    }

    return match?.id;
};

/**
 * Access level a plan grants, derived from the same map the webhook uses.
 * Echoed back to the client so the `purchase` event can carry the tier.
 */
export const getAccessLevelForPlan = (plan: string): string | undefined => {
    const productId = PLAN_PRODUCT_IDS[plan];
    return productId ? productIdMap[productId]?.accessLevel : undefined;
};
