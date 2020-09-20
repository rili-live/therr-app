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
        <h1>Therr App: User Account Verification</h1>
        <h2>Welcome, ${templateParams.name}!</h2>
        <h3>Username: ${templateParams.userName}</h3>
        <p>Click the following link to verify your account.</p>
        <p><a href="${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}">${globalConfig[process.env.NODE_ENV].hostFull}/verify-account</a></p>
        <p></p>
        <p>If you are unable to click the link, copy paste the following URL in the browser:</p>
        <p>${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}</p>
    `;

    return sendEmail({
        ...emailParams,
        html,
    });
};
