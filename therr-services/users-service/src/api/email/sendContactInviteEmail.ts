/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';

export interface ISendContactInviteEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    fromName: string;
    fromEmail: string;
    toEmail: string;
}

// TODO: Localize email
export default (emailParams: ISendContactInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const htmlConfig = {
        header: `New invite from ${templateParams.fromName}!`,
        dearUser: `Hi, ${templateParams.toEmail}!`,
        body1: `${templateParams.fromName} has invited you to connect on Therr app. You can e-mail them directly at ${templateParams.fromEmail}`,
        body2: 'Follow the link below to sign up today.',
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}`,
        buttonText: 'Go Therr',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${globalConfig[process.env.NODE_ENV].hostFull}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
