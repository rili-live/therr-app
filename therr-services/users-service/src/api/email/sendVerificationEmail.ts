/* eslint-disable max-len */
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import { getHostContext } from '../../constants/hostContext';

export interface ISendVerificationEmailConfig {
    charset?: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    name: string;
    verificationCodeToken: string;
}

/**
 * Uses the localhost path in developement or applies the brand context to the various environment
 * paths. Ex.) maintains stage. on stage [stage.<some-host>]
 */
const getLinkUrl = (verificationCodeToken: string, host: string, isDashboardRegistration: boolean) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const basePath = isDashboardRegistration
        ? globalConfig[process.env.NODE_ENV].dashboardHostFull
        : globalConfig[process.env.NODE_ENV].hostFull;
    const basePathWithBranding = isDevelopment ? basePath : basePath.replace(/^(stage\.)(.*?)$/, `$1${host}`);

    return `${basePathWithBranding}/verify-account?token=${verificationCodeToken}`;
};

// TODO: Localize email
export default (emailParams: ISendVerificationEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const linkUrl = getLinkUrl(templateParams.verificationCodeToken, contextConfig.host, isDashboardRegistration);
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
        subject: `[Account Verification] ${contextConfig.brandShortName} User Account`,
    }, htmlConfig);
};
