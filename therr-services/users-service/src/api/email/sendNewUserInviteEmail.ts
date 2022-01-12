/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import templateString from './template';

export interface ISendNewUserInviteEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    fromName: string;
    fromEmail: string;
    toEmail: string;
    verificationCodeToken: string;
    oneTimePassword: string;
}

// TODO: Localize email
export default (emailParams: ISendNewUserInviteEmailConfig, templateParams: ITemplateParams) => {
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Your Profile Awaits!',
        dearUser: `Hi, ${templateParams.toEmail}!`,
        body1: `You have been invited to connect with ${templateParams.fromName} on Therr app. You can e-mail them directly at ${templateParams.fromEmail}`,
        body2: 'Follow the link below to finish creating your profile, and use this one-time password:',
        bodyBold: templateParams.oneTimePassword,
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}`,
        buttonText: 'Go Therr',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};
