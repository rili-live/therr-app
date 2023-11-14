import Stripe from 'stripe';
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import sendAdminUrgentErrorEmail from '../api/email/admin/sendAdminUrgentErrorEmail';
import { handleSubscriptionCreateUpdate, productIdToAccessLvlMap } from './helpers/payment-webhook-handlers';
import stripe from '../api/stripe';
import Store from '../store';

const activateUserSubscription = (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-userid'];

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
            if (response.mode === 'subscription') {
                (response.subscription as Stripe.Subscription)?.items.data.forEach((item) => {
                    const accessLevel = productIdToAccessLvlMap[(item.price.product as string)];
                    if (productIdToAccessLvlMap[(item.price.product as string)]) {
                        accessLevels.push(accessLevel);
                    }
                    productIds.push(item.price.product);
                });
            }

            const userAccessLevels = new Set(
                existingUser?.accessLevels || [],
            );
            accessLevels.forEach((level) => userAccessLevels.add(level));

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
    // TODO: Validate event signature with process.env.STRIPE_WEBHOOK_SIGNING_SECRET
    // https://stripe.com/docs/webhooks/quickstart
    const event = req.body;
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
            // Occurs when subscription ends
            case 'customer.subscription.deleted':
                // TODO: Add better handlers
                sendAdminUrgentErrorEmail({
                    subject: '[Urgent] Unknown Webhook',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                }, {
                    errorMessage: 'This webhook does not have a handler implemented',
                }, {
                    webhookEventType: event.type,
                    webhookEventAmount: eventObject.amount,
                    webhookEventStatus: eventObject.status,
                });
                break;
            case 'customer.subscription.paused':
                // TODO: Add better handlers
                sendAdminUrgentErrorEmail({
                    subject: '[Urgent] Unknown Webhook',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                }, {
                    errorMessage: 'This webhook does not have a handler implemented',
                }, {
                    webhookEventType: event.type,
                    webhookEventAmount: eventObject.amount,
                    webhookEventStatus: eventObject.status,
                });
                break;
            case 'customer.subscription.resumed':
                // TODO: Add better handlers
                sendAdminUrgentErrorEmail({
                    subject: '[Urgent] Unknown Webhook',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                }, {
                    errorMessage: 'This webhook does not have a handler implemented',
                }, {
                    webhookEventType: event.type,
                    webhookEventAmount: eventObject.amount,
                    webhookEventStatus: eventObject.status,
                });
                break;
            case 'customer.subscription.pending_update_applied':
                // TODO: Add better handlers
                sendAdminUrgentErrorEmail({
                    subject: '[Urgent] Unknown Webhook',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                }, {
                    errorMessage: 'This webhook does not have a handler implemented',
                }, {
                    webhookEventType: event.type,
                    webhookEventAmount: eventObject.amount,
                    webhookEventStatus: eventObject.status,
                });
                break;
            case 'customer.subscription.pending_update_expired':
                // TODO: Add better handlers
                sendAdminUrgentErrorEmail({
                    subject: '[Urgent] Unknown Webhook',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                }, {
                    errorMessage: 'This webhook does not have a handler implemented',
                }, {
                    webhookEventType: event.type,
                    webhookEventAmount: eventObject.amount,
                    webhookEventStatus: eventObject.status,
                });
                break;
            case 'customer.subscription.trial_will_end':
                // TODO: Add better handlers
                sendAdminUrgentErrorEmail({
                    subject: '[Urgent] Unknown Webhook',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                }, {
                    errorMessage: 'This webhook does not have a handler implemented',
                }, {
                    webhookEventType: event.type,
                    webhookEventAmount: eventObject.amount,
                    webhookEventStatus: eventObject.status,
                });
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

export {
    activateUserSubscription,
    handleWebhookEvents,
};
