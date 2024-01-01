/* eslint-disable max-len */
import sendEmail from '../sendEmail';

export interface ISendAdminNewBusinessSubscriptionEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    customerEmail: string;
}

export interface IAccountTypeParams {
    webhookEventType: string,
    webhookEventAmount: number,
    webhookEventStatus: string,
    userId?: string;
    userEmail?: string;
}

export default (emailParams: ISendAdminNewBusinessSubscriptionEmailConfig, templateParams: ITemplateParams, orderDetails: IAccountTypeParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const dearUser = `Welcome the new business dashboard subscriber, ${templateParams.customerEmail}`;
    const htmlConfig = {
        header: 'Therr App: New Business Subscriber 🎉',
        dearUser,
        body1: `A new user subscribed to the dashboard 🎉 (${JSON.stringify(orderDetails)})`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    }, htmlConfig);
};
