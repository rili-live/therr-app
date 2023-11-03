import Stripe from 'stripe';
import { AccessLevels, ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizeEmail from 'normalize-email';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import sendAdminNewBusinessSubscriptionEmail from '../api/email/admin/sendAdminNewBusinessSubscriptionEmail';
import sendDashboardSubscriberIntroEmail from '../api/email/for-business/sendDashboardSubscriberIntroEmail';
import sendDashboardSubscriberUserNotFoundEmail from '../api/email/for-business/sendDashboardSubscriberUserNotFoundEmail';
import sendAdminUrgentErrorEmail from '../api/email/admin/sendAdminUrgentErrorEmail';

const productIdsMap = {
    prod_OK9dEHmueTGDZ1: AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
    prod_OK9e5d2awEPukG: AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
    prod_OK9f7dJp7rtPB8: AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2022-11-15',
});

const handleSubscriptionCreateUpdate = async (event) => {
    const eventObject = event.data.object;

    const customer = await stripe.customers.retrieve(eventObject.customer) as Stripe.Customer;
    const product = await stripe.products.retrieve(eventObject.plan?.product);

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Customer Subscription Created'],
        traceArgs: {
            'subscription.planId': eventObject.plan?.id,
            'subscription.planAmount': eventObject.plan?.amount,
            'subscription.productId': eventObject.product?.id,
            'subscription.productName': product.name,
            'subscription.trialStart': eventObject.trial_start ? eventObject.trial_start * 1000 : undefined,
            'subscription.trialEnd': eventObject.trial_end ? eventObject.trial_end * 1000 : undefined,
            'subscription.status': eventObject.status,
        },
    });

    const normedEmail = normalizeEmail(customer.email || eventObject?.receipt_email || eventObject?.billing_details?.email);

    if (eventObject.status === 'trialing') {
        if (normedEmail) {
            await Store.users.getUsers({
                email: normedEmail,
            }, {}, {}, ['accessLevels']).then(([user]) => {
                sendDashboardSubscriberIntroEmail({
                    subject: 'Free Trial Activated: Therr for Business',
                    toAddresses: [normedEmail],
                }, {
                    productName: product.name,
                });

                if (user) {
                    const userAccessLevels = new Set(
                        user.accessLevels,
                    );
                    userAccessLevels.add(productIdsMap[product.id] || AccessLevels.DASHBOARD_SUBSCRIBER_BASIC);
                    return Store.users.updateUser({
                        accessLevels: JSON.stringify([...userAccessLevels]),
                    }, {
                        id: user.id,
                    });
                }

                // User Not Found: Send email to rectify account subscription status
                sendDashboardSubscriberUserNotFoundEmail({
                    subject: 'Subscriber Missing Email | Not Found',
                    toAddresses: [normedEmail, process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                }, {
                    productName: product.name,
                });
            });
        } else {
            console.error('Missing customer email for subscriber free trial');
        }
    } else if (eventObject.status === 'active') {
        // TODO: Send subscription started email (trial phase completed)
    }

    sendAdminNewBusinessSubscriptionEmail({
        subject: '[New Subscriber] New Dashboard Payment',
        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
    }, {
        customerEmail: normedEmail,
    }, {
        webhookEventType: event.type,
        webhookEventAmount: eventObject.amount,
        webhookEventStatus: eventObject.status,
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
    handleWebhookEvents,
};
