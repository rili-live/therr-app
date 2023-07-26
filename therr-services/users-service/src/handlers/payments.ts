import Stripe from 'stripe';
import { ErrorCodes } from 'therr-js-utilities/constants';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import sendAdminNewBusinessSubscriptionEmail from '../api/email/admin/sendAdminNewBusinessSubscriptionEmail';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2022-11-15',
});

const handleWebhookEvents = (req, res) => {
    // TODO: Validate event signature with process.env.STRIPE_WEBHOOK_SIGNING_SECRET
    // https://stripe.com/docs/webhooks/quickstart
    const event = req.body;
    const eventObject = event.data.object;

    printLogs({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Webhook event received'],
        tracer: beeline,
        traceArgs: {
            webhookEventType: event.type,
            webhookEventAmount: eventObject.amount,
            webhookEventStatus: eventObject.status,
        },
    });

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            // Then define and call a method to handle the successful payment intent.
            // handlePaymentIntentSucceeded(eventObject);
            sendAdminNewBusinessSubscriptionEmail({
                subject: '[New Subscriber] New Dashboard Payment',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            }, {
                customerEmail: eventObject?.receipt_email || eventObject?.billing_details?.email,
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
            printLogs({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Unhandled webhook event type'],
                tracer: beeline,
                traceArgs: {
                    webhookEventType: event.type,
                    webhookEventAmount: eventObject.amount,
                    webhookEventStatus: eventObject.status,
                },
            });
    }

    return res.status(200).send({ message: 'Webhooked' });
};

export {
    handleWebhookEvents,
};
