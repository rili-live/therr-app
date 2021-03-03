/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import templateString from './template';

export interface ISendVerificationEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    name: string;
    userName: string;
    verificationCodeToken: string;
}

export default (emailParams: ISendVerificationEmailConfig, templateParams: ITemplateParams) => {
    const template = Handlebars.compile(templateString);
    const html = template({
        header: 'Therr App: User Account Verification',
        dearUser: `Welcome, ${templateParams.name}!`,
        body1: `A new user account was successfully created with the username, ${templateParams.userName}. Click the following link to verify your account.`,
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}`,
        buttonText: 'Verify My Account',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}`,
    });

    return sendEmail({
        ...emailParams,
        html,
    });
};
