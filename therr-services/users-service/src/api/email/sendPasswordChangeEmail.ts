/* eslint-disable max-len */

import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';

export interface ISendPasswordChangeEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    email: string;
    userName: string;
}

export default (emailParams: ISendPasswordChangeEmailConfig, templateParams: ITemplateParams) => {
    const html = `
        <h1>Therr App: Password Changed</h1>
        <h2>Hi, ${templateParams.userName}!</h2>
        <p>Your password has been successfully changed.</p>
        <p>If you did not initiate this change, please contact us immediately.</p>
        <p></p>
        <p><a href="${globalConfig[process.env.NODE_ENV].hostFull}/login">${globalConfig[process.env.NODE_ENV].hostFull}/login</a></p>
    `;

    return sendEmail({
        ...emailParams,
        html,
    });
};
