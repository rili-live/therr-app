import Stripe from 'stripe';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import sendAdminUrgentErrorEmail from '../api/email/admin/sendAdminUrgentErrorEmail';
import {
    handleSubscriptionCreateUpdate,
    handleSubscriptionDeleted,
    handleSubscriptionPaused,
    handleSubscriptionResumed,
    handleSubscriptionTrialWillEnd,
    productIdMap,
} from './helpers/payment-webhook-handlers';
import stripe from '../api/stripe';
import Store from '../store';
import * as globalConfig from '../../../../global-config';

const activateUserSubscription = (req, res) => {
    const { id } = req.params;
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return stripe.checkout.sessions.retrieve(id, {
        expand: ['subscription'],
    }).then((response) => {
        let isAccessLevelUpdated = false;
        const billingEmail = response.customer_details?.email || response.customer_email;
        const productIds: any = [];
        const accessLevels: any = [];

        const fetchUserByEmail = (!userId && billingEmail) ? Store.users.getUserByEmail(billingEmail) : Promise.resolve([]);
        const fetchUserPromise = userId ? Store.users.getUserById(userId) : fetchUserByEmail;

        return fetchUserPromise.then(([existingUser]) => {
            if (response.mode === 'subscription' && response.payment_status === 'paid' && response.status === 'complete') {
                (response.subscription as Stripe.Subscription)?.items.data.forEach((item) => {
                    const accessLevel = productIdMap[(item.price.product as string)]?.accessLevel;
                    if (productIdMap[(item.price.product as string)]?.accessLevel) {
                        accessLevels.push(accessLevel);
                    }
                    productIds.push(item.price.product);
                });
            }

            const userAccessLevels = new Set(
                existingUser?.accessLevels || [],
            );
            accessLevels.forEach((level) => userAccessLevels.add(level));

            // TODO: Only update user if subscription has started free trial or paid
            const updateUserPromise = (existingUser && accessLevels.length)
                ? Store.users.updateUser({
                    accessLevels: JSON.stringify([...userAccessLevels]),
                }, { id: existingUser.id })
                : Promise.resolve([]);

            return updateUserPromise.then(([updatedUser]) => {
                if (updatedUser) {
                    isAccessLevelUpdated = true;
                }

                return res.status(200).send({
                    billingEmail,
                    mode: response.mode,
                    paymentStatus: response.payment_status,
                    productIds,
                    status: response.status,
                    isAccessLevelUpdated,
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

        const returnUrl = req.body.returnUrl
            || `https://${globalConfig[process.env.NODE_ENV].dashboardHost}/settings`;

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
    createCustomerPortalSession,
    handleWebhookEvents,
};
