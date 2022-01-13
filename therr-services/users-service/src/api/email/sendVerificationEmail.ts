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
    verificationCodeToken: string;
}

// TODO: Localize email
export default (emailParams: ISendVerificationEmailConfig, templateParams: ITemplateParams) => {
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Therr App: User Account Verification',
        dearUser: `Welcome, ${templateParams.name}!`,
        body1: 'Your new user account was successfully created. Click the following link to verify your account.',
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}`,
        buttonText: 'Verify My Account',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};
