import Stripe from 'stripe';
import { AccessLevels } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizeEmail from 'normalize-email';
import stripe from '../../api/stripe';
import Store from '../../store';
import { productIdMap } from './payment-webhook-handlers';

/**
 * Subscription statuses that entitle an account to its plan's access level.
 *
 * `trialing` is the one that used to be missed. `activateUserSubscription` gated on
 * `payment_status === 'paid'`, but a Checkout Session that only starts a free trial completes
 * with `payment_status: 'no_payment_required'` — so the plan the user just signed up for
 * granted nothing, and the account was upgraded only later by the `customer.subscription.*`
 * webhook, which does honour `trialing`. That made the upgrade silently dependent on
 * STRIPE_WEBHOOK_SIGNING_SECRET being configured: with it unset, `handleWebhookEvents` skips
 * signature validation but the events still have to arrive, and nothing else granted the level.
 *
 * Kept in sync with `handleSubscriptionCreateUpdate`, which branches on the same two statuses.
 */
const GRANTING_SUBSCRIPTION_STATUSES = ['trialing', 'active'];

export interface ICheckoutSessionGrant {
    /** Access levels the session's products map to. Empty unless `isGrantable`. */
    accessLevels: AccessLevels[];
    /** Stripe product ids on the session's subscription. Empty unless `isGrantable`. */
    productIds: string[];
    /** The address the customer paid with — the only identity a Checkout Session carries. */
    billingEmail?: string;
    isGrantable: boolean;
    subscriptionStatus?: string;
    /** Raw session fields, echoed back to the dashboard by `activateUserSubscription`. */
    mode?: string;
    paymentStatus?: string;
    status?: string;
}

/**
 * Retrieve a Checkout Session and reduce it to "what, if anything, does this entitle an
 * account to". Does no account lookup and no writing — callers decide *who* gets the levels,
 * which is the half that differs between the register, login and activate paths.
 */
export const resolveCheckoutSessionGrant = (paymentSessionId: string): Promise<ICheckoutSessionGrant> => stripe.checkout.sessions
    .retrieve(paymentSessionId, {
        expand: ['subscription'],
    })
    .then((session) => {
        const subscription = session.subscription as Stripe.Subscription | null;
        const billingEmail = session.customer_details?.email || session.customer_email || undefined;
        const productIds: string[] = [];
        const accessLevels: AccessLevels[] = [];

        // Gated on the subscription's *current* status, never on `payment_status`. A session's
        // `payment_status` is frozen at 'paid' for the life of the object, so accepting it as an
        // alternative let a canceled or paused subscriber replay their old session id — through
        // `/login?paymentSessionId=` or `/register?paymentSessionId=`, both of which still sit in
        // browser history after `PaymentComplete` redirects — and re-grant themselves the very
        // level `revokeDashboardAccess` had just removed, indefinitely and for free.
        //
        // Nothing is lost by dropping that disjunct: a healthy paid checkout reports `active`
        // here, a trial reports `trialing`, and when `subscription` fails to expand there are no
        // line items to map to an access level anyway. The one case it narrows is a redirect that
        // beats Stripe's own flip to `active`, which the subscription webhook then grants a beat
        // later — the same fail-open posture the rest of this module takes.
        const isGrantable = session.mode === 'subscription'
            && session.status === 'complete'
            && GRANTING_SUBSCRIPTION_STATUSES.includes(`${subscription?.status}`);

        if (isGrantable) {
            subscription?.items?.data?.forEach((item) => {
                const productId = item.price.product as string;
                productIds.push(productId);
                const accessLevel = productIdMap[productId]?.accessLevel as AccessLevels;
                if (accessLevel) {
                    accessLevels.push(accessLevel);
                }
            });
        }

        return {
            accessLevels,
            productIds,
            billingEmail,
            isGrantable,
            subscriptionStatus: subscription?.status,
            mode: session.mode || undefined,
            paymentStatus: session.payment_status,
            status: session.status || undefined,
        };
    });

/**
 * Why an activation that otherwise succeeded granted no access level.
 *
 * `activateUserSubscription` answers 200 in every one of these cases — the purchase is real and
 * the dashboard still needs the session details to render a receipt — so without a reason code a
 * refusal is indistinguishable from "there was nothing to grant". The case that matters is
 * `billing-email-mismatch`: a customer who paid Stripe with a different address than their Therr
 * account is refused silently today, and the UI has no way to tell them which address to use.
 *
 * Advisory only. Never widen a grant on the strength of one of these — they exist so the client
 * can explain a refusal, not so it can work around it.
 */
export type SubscriptionNotGrantedReason =
    | 'session-not-grantable'
    | 'no-mapped-access-level'
    | 'account-not-found'
    | 'billing-email-mismatch';

/**
 * A Checkout Session id is a bearer token for a *purchase*, not for an *account*. Nothing in
 * the session ties it to the caller presenting it, so the only identity it carries is the
 * address the customer paid with — the same field `handleSubscriptionCreateUpdate` keys its
 * grants off. Requiring the two to agree keeps the session path and the webhook path from
 * upgrading different accounts for one purchase, and stops a leaked or replayed session id
 * from being redeemed against an account that did not buy it.
 *
 * Fails closed: no billing email on the session, or no email on the account, is a mismatch.
 */
export const doesSessionEmailMatchAccount = (grant: ICheckoutSessionGrant, accountEmail?: string): boolean => {
    if (!grant.billingEmail || !accountEmail) {
        return false;
    }

    return normalizeEmail(grant.billingEmail) === normalizeEmail(accountEmail);
};

/**
 * The register/login shape: resolve a session to the access levels an account with
 * `accountEmail` may claim from it, or an empty list.
 *
 * Fails **open** — every rejection path returns `[]` rather than throwing. A Stripe outage, a
 * malformed session id or a mismatched email must not block a registration or a sign-in; the
 * subscription webhook grants the level independently, so the worst case is that the upgrade
 * lands a beat later instead of on the redirect.
 */
export const resolveAccessLevelsForAccountEmail = (
    paymentSessionId: string,
    accountEmail: string | undefined,
    traceContext: { [key: string]: any } = {},
): Promise<AccessLevels[]> => resolveCheckoutSessionGrant(paymentSessionId)
    .then((grant) => {
        if (!grant.isGrantable) {
            logSpan({
                level: 'info',
                messageOrigin: 'API_SERVER',
                messages: ['Checkout session is not in a grantable state'],
                traceArgs: {
                    ...traceContext,
                    'stripe.sessionId': paymentSessionId,
                    'subscription.status': grant.subscriptionStatus,
                },
            });
            return [];
        }

        if (!doesSessionEmailMatchAccount(grant, accountEmail)) {
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: ['Checkout session billing email does not match the account claiming it'],
                traceArgs: {
                    ...traceContext,
                    'stripe.sessionId': paymentSessionId,
                    'subscription.status': grant.subscriptionStatus,
                    'session.hasBillingEmail': !!grant.billingEmail,
                },
            });
            return [];
        }

        return grant.accessLevels;
    })
    .catch((err) => {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to resolve access levels from checkout session'],
            traceArgs: {
                ...traceContext,
                'stripe.sessionId': paymentSessionId,
                'error.message': err?.message,
            },
        });
        return [];
    });

/** Union of an account's current levels with newly granted ones, order-stable and de-duplicated. */
export const mergeAccessLevels = (existing: any, granted: AccessLevels[]): string[] => {
    const merged = new Set<string>(existing || []);
    granted.forEach((level) => merged.add(level));
    return [...merged];
};

/**
 * The login shape: grant an *existing* account whatever its checkout session entitles it to,
 * and hand back the user object the session token should be minted from.
 *
 * Persisting before the token is issued is the point — access levels are baked into the JWT,
 * so a grant applied after `issueUserSession` would not take effect until the user signed in
 * a second time, which is the same "I paid and nothing happened" the redirect exists to avoid.
 *
 * Returns `userDetails` unchanged when there is nothing to add or the write fails; a failed
 * upgrade must never cost the user their sign-in.
 */
export const applyCheckoutSessionAccessLevels = async (paymentSessionId: string, userDetails: any): Promise<any> => {
    const granted = await resolveAccessLevelsForAccountEmail(paymentSessionId, userDetails?.email, {
        'user.id': userDetails?.id,
        handler: 'login',
    });

    if (!granted.length) {
        return userDetails;
    }

    const mergedAccessLevels = mergeAccessLevels(userDetails?.accessLevels, granted);

    if (mergedAccessLevels.length === (userDetails?.accessLevels || []).length) {
        return userDetails;
    }

    try {
        await Store.users.updateUser({
            accessLevels: JSON.stringify(mergedAccessLevels),
        }, { id: userDetails.id });

        return {
            ...userDetails,
            accessLevels: mergedAccessLevels,
        };
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to persist checkout session access levels'],
            traceArgs: {
                'user.id': userDetails?.id,
                'stripe.sessionId': paymentSessionId,
                'error.message': err?.message,
            },
        });
        return userDetails;
    }
};

export default resolveCheckoutSessionGrant;
