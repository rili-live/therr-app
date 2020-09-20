/* eslint-disable max-len */

import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';

export interface ISendOneTimePasswordConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    oneTimePassword: string;
}

export default (emailParams: ISendOneTimePasswordConfig, templateParams: ITemplateParams) => {
    const html = `
        <h1>Therr App: One-time Password</h1>
        <h3>Your one time password: ${templateParams.oneTimePassword}</h3>
        <p></p>
        <p>Use this password to login and update your forgotten password.</p>
        <p><a href="${globalConfig[process.env.NODE_ENV].hostFull}/login">${globalConfig[process.env.NODE_ENV].hostFull}/login</a></p>
    `;

    return sendEmail({
        ...emailParams,
        html,
    });
};
