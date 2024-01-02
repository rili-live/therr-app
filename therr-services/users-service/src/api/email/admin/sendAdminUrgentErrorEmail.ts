/* eslint-disable max-len */
import sendEmail from '../sendEmail';

export interface ISendAdminUrgentErrorEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    errorMessage: string;
}

export interface IAccountTypeParams {
    webhookEventType?: string,
    webhookEventAmount?: number,
    webhookEventStatus?: string,
    webhookCustomerId?: string,
    activationCode?: string;
    userEmail?: string;
}

export default (emailParams: ISendAdminUrgentErrorEmailConfig, templateParams: ITemplateParams, errorDetails: IAccountTypeParams) => {
    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',');
    const dearUser = 'Oops something went wrong!';
    const htmlConfig = {
        header: 'This is an urgent error',
        dearUser,
        body1: `ErrorMessage: ${templateParams.errorMessage}`,
        body2: `AdditionalDetails: ${JSON.stringify(errorDetails)}`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses: [...emailParams.toAddresses, ...otherEmails],
    }, htmlConfig);
};
