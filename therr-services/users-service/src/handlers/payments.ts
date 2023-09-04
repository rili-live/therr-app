import Stripe from 'stripe';
import { ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import sendAdminNewBusinessSubscriptionEmail from '../api/email/admin/sendAdminNewBusinessSubscriptionEmail';
import sendDashboardSubscriberIntroEmail from '../api/email/sendDashboardSubscriberIntroEmail';

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

    // TODO: Search for user in db and update accessLevel
    if (eventObject.status === 'trialing') {
        // TODO: Send trial started email
        if (customer.email) {
            sendDashboardSubscriberIntroEmail({
                subject: 'Free Trial Activated: Therr for Business',
                toAddresses: ['zanselm5@gmail.com'],
            }, {
                productName: product.name,
            });
        } else {
            console.error('Missing customer email for subscriber free trial');
        }
    } else if (eventObject.status === 'active') {
        // TODO: Send subscription started email
    }

    sendAdminNewBusinessSubscriptionEmail({
        subject: '[New Subscriber] New Dashboard Payment',
        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
    }, {
        customerEmail: customer.email || eventObject?.receipt_email || eventObject?.billing_details?.email,
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
                break;
            case 'customer.subscription.paused':
                break;
            case 'customer.subscription.resumed':
                break;
            case 'customer.subscription.pending_update_applied':
                break;
            case 'customer.subscription.pending_update_expired':
                break;
            case 'customer.subscription.trial_will_end':
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
