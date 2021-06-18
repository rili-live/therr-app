/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import templateString from './template';

export interface ISendOneTimePasswordConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    name: string;
    oneTimePassword: string;
}

export default (emailParams: ISendOneTimePasswordConfig, templateParams: ITemplateParams) => {
    const template = Handlebars.compile(templateString);
    const html = template({
        header: 'Therr App: One-time Password',
        dearUser: `Hi ${templateParams.name},`,
        body1: 'Looks like you forgot your password and requested a reset. Use this temporary password to access your account. After login, you can reset your password from the user settings page.',
        body2: 'Your temporary, one time password:',
        bodyBold: templateParams.oneTimePassword,
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/login`,
        buttonText: 'Go to Login',
    });

    return sendEmail({
        ...emailParams,
        html,
    });
};
