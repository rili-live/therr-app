/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';

export interface ISendVerificationEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    name: string;
    verificationCodeToken: string;
}

// TODO: Localize email
export default (emailParams: ISendVerificationEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const linkUrl = isDashboardRegistration
        ? `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/verify-account?token=${templateParams.verificationCodeToken}`
        : `${globalConfig[process.env.NODE_ENV].hostFull}/verify-account?token=${templateParams.verificationCodeToken}`;
    const htmlConfig = {
        header: `${contextConfig.brandName}: User Account Verification`,
        dearUser: `Welcome, ${templateParams.name}!`,
        body1: 'Your new user account was successfully created. Click the following link to verify your account.',
        buttonHref: linkUrl,
        buttonText: 'Verify My Account',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${linkUrl}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
