/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';

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
    const contextConfig = getHostContext(emailParams.agencyDomainName);

    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const dearUser = `Welcome the new business dashboard subscriber, ${templateParams.customerEmail}`;
    const htmlConfig = {
        header: `${contextConfig.brandName}: New Business Subscriber 🎉`,
        dearUser,
        body1: `A new user subscribed to the dashboard 🎉 (${JSON.stringify(orderDetails)})`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    }, htmlConfig);
};
