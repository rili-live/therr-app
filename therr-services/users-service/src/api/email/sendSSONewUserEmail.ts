/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import templateString from './template';

export interface ISendSSONewUserConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    name: string;
    oneTimePassword: string;
}

// TODO: Localize email
export default (emailParams: ISendSSONewUserConfig, templateParams: ITemplateParams) => {
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Therr App: User Account Created',
        dearUser: `Hi ${templateParams.name},`,
        body1: 'A new user account was successfully created. Click the following link to login, choose a username, and set your password. You can login with SSO or directly with your account password.',
        body2: 'Your temporary, one time password:',
        bodyBold: templateParams.oneTimePassword,
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/login`,
        buttonText: 'Go Therr',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${globalConfig[process.env.NODE_ENV].hostFull}/login`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};
