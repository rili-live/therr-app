/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';

export interface ISendAdminNewBusinessSubscriptionEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    customerEmail: string;
}

export interface IAccountTypeParams {
    webhookEventType: string,
    webhookEventAmount: number,
    webhookEventStatus: string,
}

export default (emailParams: ISendAdminNewBusinessSubscriptionEmailConfig, templateParams: ITemplateParams, orderDetails: IAccountTypeParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const template = Handlebars.compile(templateString);
    const dearUser = `Welcome the new business dashboard subscriber, ${templateParams.customerEmail}`;
    const htmlConfig = {
        header: 'Therr App: New Business Subscriber 🎉',
        dearUser,
        body1: `A new user subscribed to the dashboard 🎉 (${JSON.stringify(orderDetails)})`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    });
};
