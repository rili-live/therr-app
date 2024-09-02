import { AccessLevels } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import sendAdminUrgentErrorEmail from '../../api/email/admin/sendAdminUrgentErrorEmail';

const handleWebhookNotConfigured = async (event, agencyDomainName: string, brandVariation = 'dashboard-therr') => {
    const eventObject = event.data.object;

    sendAdminUrgentErrorEmail({
        subject: '[Urgent] Unknown Webhook',
        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
        agencyDomainName,
        brandVariation,
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
