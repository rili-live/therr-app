/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import templateString from '../template';

export interface ISendAdminUrgentErrorEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    errorMessage: string;
}

export interface IAccountTypeParams {
    webhookEventType?: string,
    webhookEventAmount?: number,
    webhookEventStatus?: string,
    activationCode?: string;
    userEmail?: string;
}

export default (emailParams: ISendAdminUrgentErrorEmailConfig, templateParams: ITemplateParams, errorDetails: IAccountTypeParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const template = Handlebars.compile(templateString);
    const dearUser = 'Oops something went wrong!';
    const htmlConfig = {
        header: 'This is an urgent error',
        dearUser,
        body1: `ErrorMessage: ${templateParams.errorMessage}`,
        body2: `AdditionalDetails: ${JSON.stringify(errorDetails)}`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    });
};
