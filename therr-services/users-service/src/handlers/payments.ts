import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import normalizeEmail from 'normalize-email';
import handleHttpError from '../utilities/handleHttpError';
import sendAdminUrgentErrorEmail from '../api/email/admin/sendAdminUrgentErrorEmail';
import {
    handleSubscriptionCreateUpdate,
    handleSubscriptionDeleted,
    handleSubscriptionPaused,
    handleSubscriptionResumed,
    handleSubscriptionTrialWillEnd,
} from './helpers/payment-webhook-handlers';
import {
    doesSessionEmailMatchAccount,
    mergeAccessLevels,
    resolveCheckoutSessionGrant,
    SubscriptionNotGrantedReason,
} from './helpers/checkoutSessionAccessLevels';
import {
    BillingPeriod,
    getAccessLevelForPlan,
    isValidPlan,
    resolvePriceId,
    TRIAL_PERIOD_DAYS,
} from './helpers/checkoutSessionPlans';
import stripe from '../api/stripe';
import Store from '../store';
import * as globalConfig from '../../../../global-config';

/**
 * Only same-origin relative paths may be used as a return destination. A
 * `cancelPath` is caller-supplied and ends up inside a Stripe `cancel_url`, so
 * without this an attacker could hand a victim a checkout link that bounces
 * them to an arbitrary site wearing a therr.com checkout as its referrer.
 *
 * Rejects protocol-relative (`//evil.com`) and absolute URLs alike by
 * requiring a single leading slash.
 */
const sanitizeReturnPath = (path: any, fallback: string): string => {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
        return fallback;
    }
    return path.slice(0, 512);
};

/**
 * Create a Stripe Checkout Session for a dashboard plan.
 *
 * This replaces the hardcoded Stripe **Payment Links** the pricing UI used to
 * open in a new tab. The links worked, but they ended the measurable journey
 * at the click: a new tab is a new GA4 session, so no purchase could ever be
 * joined to the campaign that produced it — the funnel's own conversion event
 * did not exist. A session created here returns to
 * `/payment-complete/{CHECKOUT_SESSION_ID}` in the *same* tab, where
 * `PaymentComplete` fires the GA4 `purchase` event.
 *
 * `metadata` carries the campaign across independently of the browser session,
 * so the attribution survives even when GA4's does not (a cleared cookie, a
 * cross-device return, a mistuned referral-exclusion list). Metadata is
 * advisory: nothing here grants access, and access levels still come from the
 * product ids on the resulting subscription.
 *
 * Deliberately unauthenticated, like the Payment Links before it — the
 * buy-then-register path is a real one, and `activateUserSubscription`
 * separately requires the billing email to match before granting anything.
 */
const createCheckoutSession = async (req, res) => {
    const { userId, whiteLabelOrigin, brandVariation } = parseHeaders(req.headers);
    const {
        plan,
        billingPeriod,
        cancelPath,
        userAcquisition,
    } = req.body;

    if (!globalConfig[process.env.NODE_ENV as string].isStripeCheckoutSessionsEnabled) {
        return handleHttpError({
            res,
            message: 'Checkout sessions are not enabled.',
            statusCode: 404,
        });
    }

    if (!isValidPlan(plan)) {
        return handleHttpError({
            res,
            message: 'Unknown plan.',
            statusCode: 400,
        });
    }

    const dashboardHostFull = globalConfig[process.env.NODE_ENV as string].dashboardHostFull;

    try {
        const priceId = await resolvePriceId(plan, (billingPeriod === 'annual' ? 'annual' : 'monthly') as BillingPeriod);

        if (!priceId) {
            return handleHttpError({
                res,
                message: 'That plan is not currently available for the selected billing period.',
                statusCode: 400,
            });
        }

        // Prefill the email for a signed-in buyer so the billing address and
        // the account address agree. That match is not a nicety: it is the
        // predicate `doesSessionEmailMatchAccount` gates the upgrade on, and a
        // buyer who types a different address gets a purchase that grants
        // nothing until support intervenes.
        const [existingUser] = userId ? await Store.users.getUserById(userId, ['id', 'email']) : [];

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${dashboardHostFull}/payment-complete/{CHECKOUT_SESSION_ID}`,
            cancel_url: `${dashboardHostFull}${sanitizeReturnPath(cancelPath, '/dashboard')}`,
            customer_email: existingUser?.email || undefined,
            client_reference_id: userId || undefined,
            allow_promotion_codes: true,
            subscription_data: {
                trial_period_days: TRIAL_PERIOD_DAYS,
            },
            metadata: {
                plan,
                billingPeriod: billingPeriod === 'annual' ? 'annual' : 'monthly',
                brandVariation: brandVariation || '',
                utmSource: `${userAcquisition?.utmSource || ''}`.slice(0, 255),
                utmMedium: `${userAcquisition?.utmMedium || ''}`.slice(0, 255),
                utmCampaign: `${userAcquisition?.utmCampaign || ''}`.slice(0, 255),
                utmContent: `${userAcquisition?.utmContent || ''}`.slice(0, 255),
            },
        });

        return res.status(200).send({
            id: session.id,
            url: session.url,
            plan,
            accessLevel: getAccessLevelForPlan(plan),
        });
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to create a Stripe checkout session'],
            traceArgs: {
                'error.message': err?.message,
                plan,
                billingPeriod,
            },
        });
        sendAdminUrgentErrorEmail({
            subject: '[Urgent Error] Checkout Session Creation Failed',
            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            agencyDomainName: whiteLabelOrigin,
            brandVariation,
        }, {
            errorMessage: err?.message,
        }, { plan });

        return handleHttpError({
            res,
            err,
            message: 'Failed to start checkout. Please try again.',
            statusCode: 500,
        });
    }
};

const activateUserSubscription = (req, res) => {
    const { id } = req.params;
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return resolveCheckoutSessionGrant(id).then((grant) => {
        let isAccessLevelUpdated = false;

        // `accessLevels` is load-bearing in the returning columns: the update below unions the
        // grant with what the account already holds, so a lookup that omits the column reads
        // as "no existing levels" and the write replaces them. `getUserByEmail` selects only
        // id/email/isUnclaimed, which is why this path goes through `getUsers` instead — via
        // that helper an email-matched activation used to strip EMAIL_VERIFIED off the
        // account and lock the user out of login.
        const normedBillingEmail = grant.billingEmail ? normalizeEmail(grant.billingEmail) : undefined;
        const fetchUserByEmail = (!userId && normedBillingEmail)
            ? Store.users.getUserByConditions({ email: normedBillingEmail }, undefined, undefined, ['id', 'email', 'accessLevels'])
            : Promise.resolve([]);
        const fetchUserPromise = userId
            ? Store.users.getUserById(userId, ['id', 'email', 'accessLevels'])
            : fetchUserByEmail;

        return fetchUserPromise.then(([existingUser]) => {
            // A session id identifies a purchase, not a purchaser. On the `userId` path the
            // caller is authenticated but the session is still just a string they supplied, so
            // without this the header alone would redeem any session id against the caller's
            // own account. Matching on billing email is also what the subscription webhook
            // does, so both paths now upgrade the same account for a given purchase.
            const isClaimableByAccount = !!existingUser && doesSessionEmailMatchAccount(grant, existingUser.email);

            // Ordered root-cause-first, so the reason names the earliest thing that went wrong
            // rather than a symptom of it: a session that is not grantable also has no access
            // levels, and an account that was never found also cannot match a billing email.
            let notGrantedReason: SubscriptionNotGrantedReason | undefined;
            if (!grant.isGrantable) {
                notGrantedReason = 'session-not-grantable';
            } else if (!grant.accessLevels.length) {
                notGrantedReason = 'no-mapped-access-level';
            } else if (!existingUser) {
                notGrantedReason = 'account-not-found';
            } else if (!isClaimableByAccount) {
                notGrantedReason = 'billing-email-mismatch';
            }

            if (notGrantedReason === 'billing-email-mismatch') {
                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['Checkout session billing email does not match the account claiming it'],
                    traceArgs: {
                        'user.id': existingUser.id,
                        'stripe.sessionId': id,
                        'subscription.status': grant.subscriptionStatus,
                        handler: 'activateUserSubscription',
                    },
                });
            }

            const updateUserPromise = (isClaimableByAccount && grant.accessLevels.length)
                ? Store.users.updateUser({
                    accessLevels: JSON.stringify(mergeAccessLevels(existingUser.accessLevels, grant.accessLevels)),
                }, { id: existingUser.id })
                : Promise.resolve([]);

            return updateUserPromise.then(([updatedUser]) => {
                if (updatedUser) {
                    isAccessLevelUpdated = true;
                }

                return res.status(200).send({
                    billingEmail: grant.billingEmail,
                    mode: grant.mode,
                    paymentStatus: grant.paymentStatus,
                    productIds: grant.productIds,
                    status: grant.status,
                    isAccessLevelUpdated,
                    notGrantedReason: isAccessLevelUpdated ? undefined : notGrantedReason,
                    // Order details for the GA4 `purchase` event fired by
                    // PaymentComplete. Reporting only — the client never
                    // decides anything from these.
                    value: grant.value,
                    currency: grant.currency,
                    plan: grant.plan,
                    billingPeriod: grant.billingPeriod,
                });
            });
        });
    }).catch((err) => {
        sendAdminUrgentErrorEmail({
            subject: '[Urgent Error] Unknown Error',
            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            agencyDomainName: whiteLabelOrigin,
            brandVariation,
        }, {
            errorMessage: err?.message,
        }, {});
        return handleHttpError({
            res,
            err,
            message: err.message,
            statusCode: 500,
        });
    });
};

const handleWebhookEvents = async (req, res) => {
    let event;

    if (process.env.STRIPE_WEBHOOK_SIGNING_SECRET) {
        const sig = req.headers['stripe-signature'];
        try {
            event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, process.env.STRIPE_WEBHOOK_SIGNING_SECRET);
        } catch (err: any) {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Webhook signature verification failed'],
                traceArgs: { 'webhook.error': err.message },
            });
            return res.status(400).send({ message: `Webhook signature verification failed: ${err.message}` });
        }
    } else {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['STRIPE_WEBHOOK_SIGNING_SECRET not configured, skipping signature validation'],
            traceArgs: {},
        });
        event = req.body;
    }

    const eventObject = event.data.object;

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Webhook event received'],
        traceArgs: {
            'webhook.eventType': event.type,
            'webhook.eventAmount': eventObject.amount,
            'webhook.eventStatus': eventObject.status,
        },
    });

    try {
        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                // Then define and call a method to handle the successful payment intent.
                // handlePaymentIntentSucceeded(eventObject);
                break;
            case 'customer.subscription.created':
                await handleSubscriptionCreateUpdate(event);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionCreateUpdate(event);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event);
                break;
            case 'customer.subscription.paused':
                await handleSubscriptionPaused(event);
                break;
            case 'customer.subscription.resumed':
                await handleSubscriptionResumed(event);
                break;
            case 'customer.subscription.pending_update_applied':
                await handleSubscriptionCreateUpdate(event);
                break;
            case 'customer.subscription.pending_update_expired':
                logSpan({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: ['Subscription pending update expired'],
                    traceArgs: { 'webhook.eventType': event.type },
                });
                break;
            case 'customer.subscription.trial_will_end':
                await handleSubscriptionTrialWillEnd(event);
                break;
            case 'payment_method.attached':
                // Then define and call a method to handle the successful attachment of a PaymentMethod.
                // handlePaymentMethodAttached(eventObject);
                break;
            default:
                // Unexpected event type
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Unhandled webhook event type'],
                    traceArgs: {
                        'webhook.eventType': event.type,
                        'webhook.eventAmount': eventObject.amount,
                        'webhook.eventStatus': eventObject.status,
                    },
                });
        }
    } catch (err: any) {
        sendAdminUrgentErrorEmail({
            subject: '[Urgent Error] Unknown Error',
            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            agencyDomainName: globalConfig[process.env.NODE_ENV].dashboardHost,
            brandVariation: '',
        }, {
            errorMessage: err?.message,
        }, {
            webhookEventType: event.type,
            webhookEventAmount: eventObject.amount,
            webhookEventStatus: eventObject.status,
        });
        return handleHttpError({
            res,
            err,
            message: err.message,
            statusCode: 500,
        });
    }

    return res.status(200).send({ message: 'Webhooked' });
};

const createCustomerPortalSession = async (req, res) => {
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    try {
        const [user] = userId ? await Store.users.getUserById(userId) : [];

        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        const email = user.billingEmail || user.email;

        // Find the Stripe customer by email
        const customers = await stripe.customers.list({ email, limit: 1 });

        if (!customers.data.length) {
            return res.status(404).send({ message: 'No subscription found for this account' });
        }

        const dashboardHost = globalConfig[process.env.NODE_ENV].dashboardHost;
        const defaultReturnUrl = `https://${dashboardHost}/settings`;
        let returnUrl = defaultReturnUrl;

        // Validate returnUrl to prevent open redirect
        if (req.body.returnUrl) {
            try {
                const parsed = new URL(req.body.returnUrl);
                if (parsed.hostname === dashboardHost || parsed.hostname === whiteLabelOrigin) {
                    returnUrl = req.body.returnUrl;
                }
            } catch {
                // Invalid URL, use default
            }
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customers.data[0].id,
            return_url: returnUrl,
        });

        return res.status(200).send({ url: portalSession.url });
    } catch (err: any) {
        sendAdminUrgentErrorEmail({
            subject: '[Urgent Error] Customer Portal Error',
            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            agencyDomainName: whiteLabelOrigin,
            brandVariation,
        }, {
            errorMessage: err?.message,
        }, {});
        return handleHttpError({
            res,
            err,
            message: err.message,
            statusCode: 500,
        });
    }
};

export {
    activateUserSubscription,
    createCheckoutSession,
    createCustomerPortalSession,
    handleWebhookEvents,
};
