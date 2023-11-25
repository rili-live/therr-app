import { AccessLevels } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import sendAdminUrgentErrorEmail from '../../api/email/admin/sendAdminUrgentErrorEmail';

export const productIdToAccessLvlMap = {
    prod_OK9dEHmueTGDZ1: AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
    prod_OK9e5d2awEPukG: AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
    prod_OK9f7dJp7rtPB8: AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
};

const handleWebhookNotConfigured = async (event) => {
    const eventObject = event.data.object;

    sendAdminUrgentErrorEmail({
        subject: '[Urgent] Unknown Webhook',
        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
    }, {
        errorMessage: 'This webhook does not have a handler implemented',
    }, {
        webhookEventType: event.type,
        webhookEventAmount: eventObject.amount,
        webhookEventStatus: eventObject.status,
        webhookCustomerId: eventObject.customer,
    });

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Customer Subscription Created'],
        traceArgs: {
            'webhook.eventType': event.type,
            'webhook.eventAmount': eventObject.amount,
            'webhook.eventStatus': eventObject.status,
        },
    });
};

export {
    handleWebhookNotConfigured,
};
